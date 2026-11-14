import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	aeonAgentNftAbi,
	aeonEscrowAbi,
	aeonRegistryAbi,
	type Deployment,
	loadDeployment,
} from "@aeon/chain";
import {
	createPublicClient,
	createTestClient,
	createWalletClient,
	type Hex,
	http,
	keccak256,
	type PublicClient,
	parseEther,
	toHex,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const CONTRACTS_DIR = fileURLToPath(
	new URL("../../../packages/contracts", import.meta.url),
);
const MNEMONIC = "test test test test test test test test test test test junk";
const DEPLOYER_KEY =
	"0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export const account = (i: number) =>
	mnemonicToAccount(MNEMONIC, { addressIndex: i });

/** The raw private key of anvil account i (for code that wants a PrivateKeyAccount). */
export const privateKeyOf = (i: number): Hex =>
	toHex(account(i).getHdKey().privateKey ?? new Uint8Array());

/** Wallet client for anvil account i on the given node. */
export const walletFor = (rpcUrl: string, i: number) =>
	createWalletClient({
		account: account(i),
		chain: foundry,
		transport: http(rpcUrl),
	});

/** Deploys a second, unrelated AeonAgentNFT (same bytecode, different address). */
export async function deployForeignNft(chain: {
	rpcUrl: string;
	client: PublicClient;
}) {
	const artifact = JSON.parse(
		readFileSync(
			`${CONTRACTS_DIR}/out/AeonAgentNFT.sol/AeonAgentNFT.json`,
			"utf8",
		),
	) as { bytecode: { object: Hex } };
	const w = walletFor(chain.rpcUrl, 9);
	const hash = await w.deployContract({
		abi: aeonAgentNftAbi,
		bytecode: artifact.bytecode.object,
		args: [w.account.address, w.account.address, w.account.address, 0n],
	});
	const receipt = await chain.client.waitForTransactionReceipt({ hash });
	if (!receipt.contractAddress) throw new Error("foreign deploy failed");
	return receipt.contractAddress;
}

export async function startChain() {
	const port = 20_000 + Math.floor(Math.random() * 20_000);
	const rpcUrl = `http://127.0.0.1:${port}`;
	const anvil = Bun.spawn(["anvil", "--port", String(port), "--silent"], {
		stdout: "ignore",
		stderr: "inherit",
	});
	const client = createPublicClient({
		chain: foundry,
		transport: http(rpcUrl),
	}) as PublicClient;
	for (let i = 0; ; i++) {
		try {
			await client.getBlockNumber();
			break;
		} catch (err) {
			if (i > 50) throw err;
			await Bun.sleep(100);
		}
	}
	const testClient = createTestClient({
		chain: foundry,
		mode: "anvil",
		transport: http(rpcUrl),
	});

	const file = `deployments/anvil-test-${port}.json`;
	const forge = Bun.spawnSync(
		[
			"forge",
			"script",
			"script/Deploy.s.sol",
			"--rpc-url",
			rpcUrl,
			"--broadcast",
		],
		{
			cwd: CONTRACTS_DIR,
			env: {
				...process.env,
				DEPLOYER_PRIVATE_KEY: DEPLOYER_KEY,
				DEPLOYMENT_FILE: file,
			},
		},
	);
	if (forge.exitCode !== 0) {
		anvil.kill();
		throw new Error(`deploy failed:\n${forge.stderr}\n${forge.stdout}`);
	}
	const deployment = loadDeployment(`${CONTRACTS_DIR}/${file}`);
	rmSync(`${CONTRACTS_DIR}/${file}`);

	return {
		rpcUrl,
		client,
		testClient,
		deployment,
		aeon: aeonDriver(rpcUrl, client, deployment),
		stop: () => anvil.kill(),
	};
}

export type Chain = Awaited<ReturnType<typeof startChain>>;

function aeonDriver(rpcUrl: string, client: PublicClient, d: Deployment) {
	const as = (i: number) =>
		createWalletClient({
			account: account(i),
			chain: foundry,
			transport: http(rpcUrl),
		});
	const wait = (hash: Hex) => client.waitForTransactionReceipt({ hash });
	const agentWallet = privateKeyToAccount(keccak256(toHex("aeon-test-agent")));

	return {
		agentWallet,
		async mintAndList(owner: number, price = parseEther("0.01")) {
			const w = as(owner);
			const mint = await client.simulateContract({
				account: w.account,
				address: d.nft,
				abi: aeonAgentNftAbi,
				functionName: "mint",
				args: [
					w.account.address,
					[{ description: "persona", dataHash: keccak256("0x01") }],
				],
			});
			await wait(await w.writeContract(mint.request));
			const tokenId = mint.result;
			await wait(
				await w.writeContract({
					address: d.nft,
					abi: aeonAgentNftAbi,
					functionName: "authorizeUsage",
					args: [tokenId, agentWallet.address, 2n],
				}),
			);
			await wait(
				await w.writeContract({
					address: d.registry,
					abi: aeonRegistryAbi,
					functionName: "list",
					args: [
						tokenId,
						price,
						`0x${agentWallet.publicKey.slice(4)}`,
						keccak256("0x02"),
					],
				}),
			);
			return tokenId;
		},
		async hire(
			tokenId: bigint,
			buyer: number,
			judge: number,
			value = parseEther("0.01"),
		) {
			const { timestamp } = await client.getBlock();
			const hire = await client.simulateContract({
				account: account(buyer),
				address: d.escrow,
				abi: aeonEscrowAbi,
				functionName: "createJob",
				args: [
					tokenId,
					keccak256("0x03"),
					timestamp + 86_400n,
					3600,
					account(judge).address,
				],
				value,
			});
			await wait(await as(buyer).writeContract(hire.request));
			return hire.result;
		},
		async submit(jobId: bigint, owner: number) {
			await wait(
				await as(owner).writeContract({
					address: d.escrow,
					abi: aeonEscrowAbi,
					functionName: "submit",
					args: [jobId, keccak256("0x04")],
				}),
			);
		},
		async complete(jobId: bigint, judge: number) {
			await wait(
				await as(judge).writeContract({
					address: d.escrow,
					abi: aeonEscrowAbi,
					functionName: "complete",
					args: [jobId],
				}),
			);
		},
	};
}
