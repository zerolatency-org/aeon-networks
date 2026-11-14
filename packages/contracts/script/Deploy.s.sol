// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script } from "forge-std/Script.sol";

import { AeonAgentNFT } from "../src/AeonAgentNFT.sol";
import { AeonEscrow } from "../src/AeonEscrow.sol";
import { AeonRegistry } from "../src/AeonRegistry.sol";
import { IAeonAgentNFT } from "../src/interfaces/IAeonAgentNFT.sol";

contract Deploy is Script {
    struct Params {
        address owner;
        address oracle;
        address feeRecipient;
        uint256 mintFee;
        uint96 minListingPrice;
        uint256 listingFee;
        AeonEscrow.Config escrow;
    }

    struct Deployment {
        AeonAgentNFT nft;
        AeonRegistry registry;
        AeonEscrow escrow;
    }

    function run() external returns (Deployment memory d) {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);
        Params memory p = defaultParams(
            deployer, vm.envOr("ORACLE_ADDRESS", deployer), vm.envOr("FEE_RECIPIENT", deployer)
        );

        uint256 startBlock = block.number;
        vm.startBroadcast(key);
        d = deploy(p);
        vm.stopBroadcast();

        string memory file =
            vm.envOr("DEPLOYMENT_FILE", string.concat("deployments/", network(), ".json"));
        _write(file, d, startBlock, deployer);
    }

    function defaultParams(address owner, address oracle, address feeRecipient)
        public
        pure
        returns (Params memory)
    {
        return Params({
            owner: owner,
            oracle: oracle,
            feeRecipient: feeRecipient,
            mintFee: 0,
            minListingPrice: 0.001 ether,
            listingFee: 0,
            escrow: AeonEscrow.Config({
                feeRecipient: feeRecipient,
                feeBps: 250,
                minAmount: 0.001 ether,
                minWindow: 60,
                maxWindow: 7 days,
                maxLifetime: 30 days,
                disputeLimit: 1 hours
            })
        });
    }

    function deploy(Params memory p) public returns (Deployment memory d) {
        d.nft = new AeonAgentNFT(p.owner, p.oracle, p.feeRecipient, p.mintFee);
        d.registry = new AeonRegistry(
            IAeonAgentNFT(address(d.nft)), p.minListingPrice, p.listingFee, p.feeRecipient
        );
        d.escrow = new AeonEscrow(IAeonAgentNFT(address(d.nft)), d.registry, p.escrow);
        d.registry.setEscrow(address(d.escrow));
    }

    function network() public view returns (string memory) {
        if (block.chainid == 16602) return "galileo";
        if (block.chainid == 16661) return "mainnet";
        if (block.chainid == 31337) return "anvil";
        return vm.toString(block.chainid);
    }

    function _write(string memory file, Deployment memory d, uint256 startBlock, address deployer)
        internal
    {
        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "startBlock", startBlock);
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "nft", address(d.nft));
        vm.serializeAddress(k, "registry", address(d.registry));
        string memory json = vm.serializeAddress(k, "escrow", address(d.escrow));
        vm.writeJson(json, file);
    }
}
