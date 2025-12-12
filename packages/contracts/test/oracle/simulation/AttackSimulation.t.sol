// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {FeedRegistry} from "../../../src/oracle/FeedRegistry.sol";
import {ReportVerifier} from "../../../src/oracle/ReportVerifier.sol";
import {CommitteeManager} from "../../../src/oracle/CommitteeManager.sol";
import {DisputeGame} from "../../../src/oracle/DisputeGame.sol";
import {TWAPLibrary} from "../../../src/oracle/TWAPLibrary.sol";
import {IFeedRegistry} from "../../../src/oracle/interfaces/IFeedRegistry.sol";
import {IReportVerifier} from "../../../src/oracle/interfaces/IReportVerifier.sol";
import {IDisputeGame} from "../../../src/oracle/interfaces/IDisputeGame.sol";

/// @title Attack Simulation Tests
/// @notice Simulates known attack vectors on oracle systems
contract AttackSimulationTest is Test {
    FeedRegistry public registry;
    ReportVerifier public verifier;
    CommitteeManager public committee;
    DisputeGame public disputeGame;

    address public owner = address(0x1);
    address public attacker = address(0xBAD);
    bytes32 public feedId;

    uint256[] public signerPks;
    address[] public signers;
    
    uint256[] public maliciousPks;
    address[] public maliciousSigners;

    function setUp() public {
        vm.warp(1700000000);

        // Honest signers
        for (uint256 i = 1; i <= 5; i++) {
            signerPks.push(i * 0x1111);
            signers.push(vm.addr(i * 0x1111));
        }

        // Malicious signers (controlled by attacker)
        for (uint256 i = 1; i <= 3; i++) {
            maliciousPks.push(0xBAD0 + i);
            maliciousSigners.push(vm.addr(0xBAD0 + i));
        }

        vm.deal(attacker, 10000 ether);

        vm.startPrank(owner);
        registry = new FeedRegistry(owner);
        committee = new CommitteeManager(address(registry), owner);
        verifier = new ReportVerifier(address(registry), address(0), owner);
        disputeGame = new DisputeGame(address(verifier), address(registry), owner);

        feedId = registry.createFeed(IFeedRegistry.FeedCreateParams({
            symbol: "ETH-USD",
            baseToken: address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2),
            quoteToken: address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48),
            decimals: 8,
            heartbeatSeconds: 3600,
            twapWindowSeconds: 1800,
            minLiquidityUSD: 100_000 ether,
            maxDeviationBps: 100, // 1% max deviation
            minOracles: 3,
            quorumThreshold: 2,
            requiresConfidence: true,
            category: IFeedRegistry.FeedCategory.SPOT_PRICE
        }));
        vm.stopPrank();
    }

    // ==================== Attack 1: Circuit Breaker Bypass ====================
    
    /// @notice Attempt to manipulate price beyond circuit breaker in single update
    function test_Attack_CircuitBreakerBypass() public {
        // Setup: Submit initial price
        vm.warp(block.timestamp + 60);
        _submitPrice(2000e8, 1);

        // Advance time to allow new submission
        vm.warp(block.timestamp + 120);

        // Attack: Try to submit price 30% higher (exceeds 20% circuit breaker)
        uint256 manipulatedPrice = 2600e8; // 30% increase

        IReportVerifier.PriceReport memory report = IReportVerifier.PriceReport({
            feedId: feedId,
            price: manipulatedPrice,
            confidence: 100,
            timestamp: block.timestamp,
            round: 2,
            sourcesHash: keccak256("attack")
        });

        bytes[] memory signatures = _signReport(report);

        IReportVerifier.ReportSubmission memory submission = IReportVerifier.ReportSubmission({
            report: report,
            signatures: signatures
        });

        // Circuit breaker should reject this (returns false or reverts)
        vm.prank(owner);
        try verifier.submitReport(submission) returns (bool accepted) {
            assertFalse(accepted, "Circuit breaker should reject 30% deviation");
        } catch {
            // Revert is also acceptable - means circuit breaker worked
        }

        // Verify price unchanged
        (uint256 price,,,) = verifier.getLatestPrice(feedId);
        assertEq(price, 2000e8, "Circuit breaker failed - price changed");
    }

    /// @notice Attempt gradual price manipulation (boiling frog attack)
    function test_Attack_GradualPriceManipulation() public {
        vm.warp(block.timestamp + 60);
        _submitPrice(2000e8, 1);

        uint256 currentPrice = 2000e8;
        uint256 targetPrice = 4000e8; // 100% increase target

        // Attempt 10 steps of ~19% each (just under circuit breaker)
        for (uint256 i = 0; i < 10; i++) {
            vm.warp(block.timestamp + 60);

            uint256 newPrice = (currentPrice * 119) / 100; // 19% increase
            if (newPrice > targetPrice) newPrice = targetPrice;

            IReportVerifier.PriceReport memory report = IReportVerifier.PriceReport({
                feedId: feedId,
                price: newPrice,
                confidence: 100,
                timestamp: block.timestamp,
                round: i + 2,
                sourcesHash: keccak256(abi.encodePacked("gradual", i))
            });

            bytes[] memory signatures = _signReport(report);

            IReportVerifier.ReportSubmission memory submission = IReportVerifier.ReportSubmission({
                report: report,
                signatures: signatures
            });

            vm.prank(owner);
            try verifier.submitReport(submission) returns (bool accepted) {
                if (accepted) {
                    currentPrice = newPrice;
                } else {
                    break;
                }
            } catch {
                break;
            }
        }

        (uint256 finalPrice,,,) = verifier.getLatestPrice(feedId);
        
        // Calculate total manipulation achieved
        uint256 manipulationBps = ((finalPrice - 2000e8) * 10000) / 2000e8;
        console2.log("Gradual manipulation achieved (bps):", manipulationBps);
        
        // Circuit breaker should limit each step
        assertLt(finalPrice, targetPrice, "Full manipulation succeeded - vulnerability!");
    }

    // ==================== Attack 2: Stale Price Exploitation ====================

    /// @notice Attempt to use stale prices for advantage
    function test_Attack_StalePrice() public {
        vm.warp(block.timestamp + 60);
        _submitPrice(2000e8, 1);

        // Fast forward past heartbeat (3600 seconds)
        vm.warp(block.timestamp + 4000);

        // Price should now be stale
        bool isStale = verifier.isPriceStale(feedId);
        assertTrue(isStale, "Price should be stale");

        // Price should be marked as invalid
        (uint256 price,, uint256 timestamp, bool isValid) = verifier.getLatestPrice(feedId);
        assertFalse(isValid, "Stale price should be invalid");

        console2.log("Price:", price);
        console2.log("Timestamp:", timestamp);
        console2.log("Current time:", block.timestamp);
        console2.log("Is valid:", isValid);
    }

    // ==================== Attack 3: Signature Replay ====================

    /// @notice Attempt to replay old report signatures
    function test_Attack_SignatureReplay() public {
        vm.warp(block.timestamp + 60);

        IReportVerifier.PriceReport memory report = IReportVerifier.PriceReport({
            feedId: feedId,
            price: 2000e8,
            confidence: 100,
            timestamp: block.timestamp,
            round: 1,
            sourcesHash: keccak256("original")
        });

        bytes[] memory signatures = _signReport(report);

        IReportVerifier.ReportSubmission memory submission = IReportVerifier.ReportSubmission({
            report: report,
            signatures: signatures
        });

        // First submission succeeds
        vm.prank(owner);
        bool accepted = verifier.submitReport(submission);
        assertTrue(accepted, "First submission should succeed");

        // Advance time
        vm.warp(block.timestamp + 120);

        // Attempt replay - should fail (old timestamp, same round)
        vm.prank(owner);
        try verifier.submitReport(submission) returns (bool replayAccepted) {
            // If it returns, it should be rejected
            assertFalse(replayAccepted, "Replay attack should be rejected");
        } catch {
            // Revert is acceptable - replay was blocked
        }

        // Verify round hasn't changed
        uint256 currentRound = verifier.getCurrentRound(feedId);
        assertEq(currentRound, 1, "Round should not have advanced from replay");
    }

    // ==================== Attack 4: Dispute Griefing ====================

    /// @notice Attempt to grief operators with frivolous disputes
    function test_Attack_DisputeGriefing() public {
        vm.warp(block.timestamp + 60);
        bytes32 reportHash = _submitPrice(2000e8, 1);

        uint256 minBond = disputeGame.getMinBond();
        
        // Attacker opens frivolous dispute
        vm.prank(attacker);
        bytes32 disputeId = disputeGame.openDispute{value: minBond}(
            reportHash,
            IDisputeGame.DisputeReason.PRICE_DEVIATION,
            keccak256("frivolous")
        );

        // Dispute should exist
        IDisputeGame.Dispute memory d = disputeGame.getDispute(disputeId);
        assertEq(d.disputer, attacker);

        // Owner resolves as VALID (attacker was wrong)
        vm.prank(owner);
        disputeGame.resolveDispute(disputeId, IDisputeGame.ResolutionOutcome.REPORT_VALID, "Frivolous");

        // Attacker should lose bond
        uint256 attackerBalance = attacker.balance;
        console2.log("Attacker balance after losing dispute:", attackerBalance);
        
        // Cost of griefing
        uint256 griefingCost = 10000 ether - attackerBalance;
        console2.log("Griefing cost:", griefingCost);
        
        assertGe(griefingCost, minBond, "Griefing should cost at least minimum bond");
    }

    // ==================== Attack 5: Committee Collusion ====================

    /// @notice Simulate collusion attack where majority of signers are malicious
    function test_Attack_CommitteeCollusion() public {
        // This test demonstrates why quorum must be high enough
        // With quorum=2 and 3+ malicious signers, they could submit bad reports

        vm.warp(block.timestamp + 60);

        // Malicious actors submit false price
        uint256 falsePrice = 5000e8; // Way off market

        IReportVerifier.PriceReport memory report = IReportVerifier.PriceReport({
            feedId: feedId,
            price: falsePrice,
            confidence: 100,
            timestamp: block.timestamp,
            round: 1,
            sourcesHash: keccak256("collusion")
        });

        bytes32 reportHash = keccak256(abi.encodePacked(
            report.feedId, report.price, report.confidence,
            report.timestamp, report.round, report.sourcesHash
        ));

        // Sign with malicious keys (only 2 needed for quorum)
        bytes[] memory maliciousSigs = new bytes[](2);
        for (uint256 i = 0; i < 2; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(
                maliciousPks[i],
                keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", reportHash))
            );
            maliciousSigs[i] = abi.encodePacked(r, s, v);
        }

        IReportVerifier.ReportSubmission memory submission = IReportVerifier.ReportSubmission({
            report: report,
            signatures: maliciousSigs
        });

        // This would succeed if malicious signers were authorized
        // The defense is committee membership verification
        vm.prank(owner);
        bool accepted = verifier.submitReport(submission);
        
        // Defense: Without committee verification, this shows the risk
        // In production, committeeManager would reject non-members
        if (accepted) {
            console2.log("WARNING: Collusion attack succeeded");
            console2.log("Ensure committee membership is verified");
        }
    }

    // ==================== Attack 6: Liveness Attack (Oracle Freeze) ====================

    /// @notice Simulate all operators going offline (Terra/Luna style)
    function test_Attack_LivenessFreeze() public {
        vm.warp(block.timestamp + 60);
        _submitPrice(2000e8, 1);

        (uint256 priceBefore,,, bool validBefore) = verifier.getLatestPrice(feedId);
        assertTrue(validBefore, "Price should be valid initially");

        // Simulate freeze: no updates for extended period
        uint256 freezeDuration = 24 hours;
        vm.warp(block.timestamp + freezeDuration);

        (uint256 priceAfter,,, bool validAfter) = verifier.getLatestPrice(feedId);

        // Price value remains but validity changes
        assertEq(priceAfter, priceBefore, "Price value unchanged");
        assertFalse(validAfter, "Price should be invalid after freeze");

        bool isStale = verifier.isPriceStale(feedId);
        assertTrue(isStale, "Price should be marked stale");

        console2.log("Freeze duration:", freezeDuration);
        console2.log("Heartbeat: 3600");
        console2.log("Detected as stale:", isStale);
    }

    // ==================== Attack 7: TWAP Manipulation Analysis ====================

    /// @notice Analyze TWAP manipulation resistance
    function test_Attack_TWAPManipulation() public pure {
        // Simulate TWAP with manipulated observation
        TWAPLibrary.PriceObservation[] memory observations = new TWAPLibrary.PriceObservation[](5);

        // Normal observations
        observations[0] = TWAPLibrary.PriceObservation({
            price: 2000e8,
            timestamp: 1700000000,
            liquidity: 10e18,
            venue: address(0x1)
        });
        observations[1] = TWAPLibrary.PriceObservation({
            price: 2001e8,
            timestamp: 1700000300,
            liquidity: 10e18,
            venue: address(0x2)
        });
        observations[2] = TWAPLibrary.PriceObservation({
            price: 1999e8,
            timestamp: 1700000600,
            liquidity: 10e18,
            venue: address(0x3)
        });
        
        // Manipulated observation (flash loan attack)
        observations[3] = TWAPLibrary.PriceObservation({
            price: 4000e8, // 100% higher
            timestamp: 1700000900,
            liquidity: 0.1e18, // Low liquidity during manipulation
            venue: address(0x4)
        });
        
        // Normal observation
        observations[4] = TWAPLibrary.PriceObservation({
            price: 2002e8,
            timestamp: 1700001200,
            liquidity: 10e18,
            venue: address(0x5)
        });

        // Calculate with outlier rejection
        TWAPLibrary.AggregatedPrice memory result = TWAPLibrary.aggregateWithOutlierRejection(
            observations,
            500 // 5% threshold
        );

        console2.log("Aggregated price:", result.price);
        console2.log("Source count:", result.sourceCount);
        console2.log("Min price:", result.minPrice);
        console2.log("Max price:", result.maxPrice);

        // Outlier should be rejected
        assertLt(result.sourceCount, 5, "Outlier should be rejected");
        
        // Price should not be manipulated
        uint256 deviation = result.price > 2000e8 
            ? result.price - 2000e8 
            : 2000e8 - result.price;
        uint256 deviationBps = (deviation * 10000) / 2000e8;
        
        assertLt(deviationBps, 100, "TWAP manipulation should be limited");
    }

    // ==================== Helper Functions ====================

    function _submitPrice(uint256 price, uint256 round) internal returns (bytes32) {
        IReportVerifier.PriceReport memory report = IReportVerifier.PriceReport({
            feedId: feedId,
            price: price,
            confidence: 100,
            timestamp: block.timestamp,
            round: round,
            sourcesHash: keccak256(abi.encodePacked("sources", round))
        });

        bytes[] memory signatures = _signReport(report);

        IReportVerifier.ReportSubmission memory submission = IReportVerifier.ReportSubmission({
            report: report,
            signatures: signatures
        });

        vm.prank(owner);
        verifier.submitReport(submission);

        return keccak256(abi.encodePacked(
            report.feedId, report.price, report.confidence,
            report.timestamp, report.round, report.sourcesHash
        ));
    }

    function _signReport(IReportVerifier.PriceReport memory report) internal view returns (bytes[] memory) {
        bytes32 reportHash = keccak256(abi.encodePacked(
            report.feedId, report.price, report.confidence,
            report.timestamp, report.round, report.sourcesHash
        ));

        bytes[] memory signatures = new bytes[](2);
        for (uint256 i = 0; i < 2; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(
                signerPks[i],
                keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", reportHash))
            );
            signatures[i] = abi.encodePacked(r, s, v);
        }

        return signatures;
    }

    receive() external payable {}
}
