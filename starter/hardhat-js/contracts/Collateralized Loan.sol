// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Collateralized Loan Contract
contract CollateralizedLoan {
    // Define the structure of a loan
    struct Loan {
        address borrower;
        address lender;
        uint collateralAmount;
        uint loanAmount;
        uint interestRate;
        uint dueDate;
        bool isFunded;
        bool isRepaid;
    }

    // Create a mapping to manage the loans
    mapping(uint => Loan) public loans;
    uint public nextLoanId;

    // Events
    event LoanRequested(uint loanId, address borrower, uint collateralAmount, uint loanAmount, uint interestRate, uint dueDate);
    event LoanFunded(uint loanId, address lender);
    event LoanRepaid(uint loanId, address borrower, uint amountRepaid);
    event CollateralClaimed(uint loanId, address lender);

    // Modifiers
    modifier loanExists(uint _loanId) {
        require(loans[_loanId].borrower != address(0), "Loan does not exist");
        _;
    }

    modifier notFunded(uint _loanId) {
        require(!loans[_loanId].isFunded, "Loan already funded");
        _;
    }

    modifier isBorrower(uint _loanId) {
        require(loans[_loanId].borrower == msg.sender, "Only the borrower can perform this action");
        _;
    }

    modifier isLender(uint _loanId) {
        require(loans[_loanId].lender == msg.sender, "Only the lender can perform this action");
        _;
    }

    // Function to deposit collateral and request a loan
    function depositCollateralAndRequestLoan(uint _interestRate, uint _duration) external payable {
        require(msg.value > 0, "Collateral must be more than 0");

        uint loanAmount = msg.value; // Using collateral amount as the loan amount
        uint dueDate = block.timestamp + _duration;

        loans[nextLoanId] = Loan({
            borrower: msg.sender,
            lender: address(0),
            collateralAmount: msg.value,
            loanAmount: loanAmount,
            interestRate: _interestRate,
            dueDate: dueDate,
            isFunded: false,
            isRepaid: false
        });

        emit LoanRequested(nextLoanId, msg.sender, msg.value, loanAmount, _interestRate, dueDate);

        nextLoanId++;
    }

    // Function to fund a loan
    function fundLoan(uint _loanId) external payable loanExists(_loanId) notFunded(_loanId) {
        Loan storage loan = loans[_loanId];
        require(msg.value == loan.loanAmount, "Incorrect loan amount");

        loan.lender = msg.sender;
        loan.isFunded = true;

        payable(loan.borrower).transfer(msg.value);

        emit LoanFunded(_loanId, msg.sender);
    }

    // Function to repay a loan
    function repayLoan(uint _loanId) external payable loanExists(_loanId) isBorrower(_loanId) {
        Loan storage loan = loans[_loanId];
        require(loan.isFunded, "Loan not yet funded");
        require(!loan.isRepaid, "Loan already repaid");

        uint repaymentAmount = loan.loanAmount + (loan.loanAmount * loan.interestRate / 100);
        require(msg.value == repaymentAmount, "Incorrect repayment amount");

        loan.isRepaid = true;

        payable(loan.borrower).transfer(loan.collateralAmount);
        payable(loan.lender).transfer(msg.value);

        emit LoanRepaid(_loanId, msg.sender, msg.value);
    }

    // Function to claim collateral on default
    function claimCollateral(uint _loanId) external loanExists(_loanId) isLender(_loanId) {
        Loan storage loan = loans[_loanId];
        require(block.timestamp > loan.dueDate, "Loan is not yet due");
        require(!loan.isRepaid, "Loan has already been repaid");

        loan.isRepaid = true; // Mark the loan as "handled" to avoid re-claims

        payable(loan.lender).transfer(loan.collateralAmount);

        emit CollateralClaimed(_loanId, loan.lender);
    }
}
