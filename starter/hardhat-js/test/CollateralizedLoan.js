// Importing necessary modules and functions from Hardhat and Chai for testing
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Describing a test suite for the CollateralizedLoan contract
describe("CollateralizedLoan", function () {
  // A fixture to deploy the contract before each test. This helps in reducing code repetition.
  async function deployCollateralizedLoanFixture() {
    // Deploying the CollateralizedLoan contract and returning necessary variables
    const [borrower, lender] = await ethers.getSigners();
    const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
    const collateralizedLoan = await CollateralizedLoan.deploy();

    return { collateralizedLoan, borrower, lender };
  }

  // Test suite for the loan request functionality
  describe("Loan Request", function () {
    it("Should let a borrower deposit collateral and request a loan", async function () {
      // Loading the fixture
      const { collateralizedLoan, borrower } = await loadFixture(deployCollateralizedLoanFixture);

      const interestRate = 5; // 5% interest rate
      const duration = 60 * 60 * 24 * 7; // 7 days duration
      const collateralAmount = ethers.parseEther("1.0"); // 1 ETH collateral
      const dueDate =(await ethers.provider.getBlock("latest")).timestamp + duration + 1;

      await expect(
        collateralizedLoan.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount })
      ).to.emit(collateralizedLoan, "LoanRequested")
      .withArgs(0, borrower.address, collateralAmount, collateralAmount, interestRate, dueDate);
    });
  });

  // Test suite for funding a loan
  describe("Funding a Loan", function () {
    it("Allows a lender to fund a requested loan", async function () {
      // Loading the fixture
      const { collateralizedLoan, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);

      // Borrower requests a loan
      const interestRate = 5;
      const duration = 60 * 60 * 24 * 7;
      const collateralAmount = ethers.parseEther("1.0");
      await collateralizedLoan.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Lender funds the loan
      await expect(
        collateralizedLoan.connect(lender).fundLoan(0, { value: collateralAmount })
      ).to.emit(collateralizedLoan, "LoanFunded")
      .withArgs(0, lender.address);

      const loan = await collateralizedLoan.loans(0);
      expect(loan.isFunded).to.be.true;
    });
  });

  // Test suite for repaying a loan
  describe("Repaying a Loan", function () {
    it("Enables the borrower to repay the loan fully", async function () {
      // Loading the fixture
      const { collateralizedLoan, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);

      // Borrower requests a loan
      const interestRate = 5;
      const duration = 60 * 60 * 24 * 7;
      const collateralAmount = ethers.parseEther("1.0");
      await collateralizedLoan.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Lender funds the loan
      await collateralizedLoan.connect(lender).fundLoan(0, { value: collateralAmount });

      // Borrower repays the loan
      const repaymentAmount = collateralAmount + (collateralAmount * BigInt(interestRate)) / BigInt(100);
      await expect(
        collateralizedLoan.connect(borrower).repayLoan(0, { value: repaymentAmount })
      ).to.emit(collateralizedLoan, "LoanRepaid")
      .withArgs(0, borrower.address, repaymentAmount);

      const loan = await collateralizedLoan.loans(0);
      expect(loan.isRepaid).to.be.true;
    });
  });

  // Test suite for claiming collateral
  describe("Claiming Collateral", function () {
    it("Permits the lender to claim collateral if the loan isn't repaid on time", async function () {
      // Loading the fixture
      const { collateralizedLoan, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);

      // Borrower requests a loan
      const interestRate = 5;
      const duration = 60 * 60 * 24 * 7;
      const collateralAmount = ethers.parseEther("1.0");
      await collateralizedLoan.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      // Lender funds the loan
      await collateralizedLoan.connect(lender).fundLoan(0, { value: collateralAmount });

      // Simulate passage of time by advancing the block timestamp
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      // Lender claims the collateral
      await expect(
        collateralizedLoan.connect(lender).claimCollateral(0)
      ).to.emit(collateralizedLoan, "CollateralClaimed")
      .withArgs(0, lender.address);

      const loan = await collateralizedLoan.loans(0);
      expect(loan.isRepaid).to.be.true;
    });
  });
});
