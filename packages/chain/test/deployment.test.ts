import { describe, expect, test } from "bun:test";

import {
	aeonContracts,
	aeonEscrowAbi,
	chainFor,
	galileo,
	JOB_STATES,
	parseDeployment,
} from "../src/index";

const sample = {
	chainId: 31337,
	startBlock: 0,
	deployer: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
	nft: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
	registry: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
	escrow: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
};

describe("deployment file", () => {
	test("parses and checksums addresses", () => {
		const d = parseDeployment(sample);
		expect(d.nft).toBe("0x5FbDB2315678afecb367f032d93F642f64180aa3");
		expect(aeonContracts(d).escrow.address).toBe(d.escrow);
	});

	test("rejects a file with a bad address or a missing field", () => {
		expect(() => parseDeployment({ ...sample, nft: "0x123" })).toThrow();
		const { escrow: _, ...missing } = sample;
		expect(() => parseDeployment(missing)).toThrow();
	});
});

describe("chains and ABIs", () => {
	test("galileo is chain 16602 with the public RPC", () => {
		expect(galileo.id).toBe(16602);
		expect(galileo.rpcUrls.default.http[0]).toBe(
			"https://evmrpc-testnet.0g.ai",
		);
		expect(chainFor(16602)).toBe(galileo);
		expect(chainFor(777, "http://x").rpcUrls.default.http).toEqual([
			"http://x",
		]);
	});

	test("the generated escrow ABI matches the JS job states", () => {
		const events = aeonEscrowAbi
			.filter((e) => e.type === "event")
			.map((e) => e.name);
		expect(events).toContain("JobCreated");
		expect(events).toContain("JobSplit");
		const getJob = aeonEscrowAbi.find(
			(e) => e.type === "function" && e.name === "getJob",
		);
		expect(getJob).toBeDefined();
		expect(JOB_STATES).toHaveLength(10);
	});
});
