const { ethers, waffle } = require('hardhat');
const { deployMockContract } = waffle
const { expect } = require('chai');
const { abi } = require('../artifacts/contracts/chainlink/AggregatorV3Interface.sol/AggregatorV3Interface.json')

const USDC_DECIMALS_MULTIPLIER = 1e6;
const USDC_TO_WEI = '758361423347072';

function parseUSDC(usdc) {
    return usdc * USDC_DECIMALS_MULTIPLIER;
}

describe('King of fools', function () {
    let owner, player1, player2, player3;
    let kingOfFools, usdcContract, mockChainlinkPriceFeed;

    beforeEach(async function () {
        [owner, player1, player2, player3] = await ethers.getSigners();

        const kingOfFoolsFactory = await ethers.getContractFactory('KingOfTheFools', owner);
        const testERC20Factory = await ethers.getContractFactory('TestERC20', owner);

        usdcContract = await testERC20Factory.deploy();
        mockChainlinkPriceFeed = await deployMockContract(owner, abi);
        kingOfFools = await kingOfFoolsFactory.deploy(usdcContract.address, mockChainlinkPriceFeed.address);

        await mockChainlinkPriceFeed.mock.latestRoundData.returns('0', USDC_TO_WEI, '0', '0', '0');

        const usdcAmount = parseUSDC(100000);
        await usdcContract.transfer(player1.address, usdcAmount);
        await usdcContract.transfer(player2.address, usdcAmount);
        await usdcContract.transfer(player3.address, usdcAmount);

        expect(await ethers.provider.getBalance(kingOfFools.address)).to.equal('0');

        expect(await usdcContract.balanceOf(kingOfFools.address)).to.equal('0');
    });

    it('should accept deposits in ETH', async function () {
        await kingOfFools.connect(player1).playWithEther({value: ethers.utils.parseEther('1')});

        expect(await ethers.provider.getBalance(kingOfFools.address)).to.equal(ethers.utils.parseEther('1'));
    });

    it('should accept deposits in USDC', async function () {
        const usdcAmount = parseUSDC(20);

        await usdcContract.connect(player1).approve(kingOfFools.address, usdcAmount);
        await kingOfFools.connect(player1).playWithUSDC(usdcAmount);

        expect(await usdcContract.balanceOf(kingOfFools.address)).to.equal(usdcAmount);
    });

    it('should make king the first player depositing ETH', async function () {
        await kingOfFools.connect(player1).playWithEther({value: ethers.utils.parseEther('1')});

        expect(await kingOfFools.currentKingOfFools()).to.equal(player1.address);
    });

    it('should make king the first player depositing USDC', async function () {
        const usdcAmount = parseUSDC(20);

        await usdcContract.connect(player1).approve(kingOfFools.address, usdcAmount);
        await kingOfFools.connect(player1).playWithUSDC(usdcAmount);

        expect(await kingOfFools.currentKingOfFools()).to.equal(player1.address);
    });

    it('should make king the second player if he deposits more ETH that first player', async function () {
        await kingOfFools.connect(player1).playWithEther({value: ethers.utils.parseEther('1')});
        await kingOfFools.connect(player2).playWithEther({value: ethers.utils.parseEther('2')});

        expect(await kingOfFools.currentKingOfFools()).to.equal(player2.address);
    });

    it('should reject player2 if he deposits less or equal ETH than 1.5x the ETH player1 deposited and player1 should still be king', async function () {
        await kingOfFools.connect(player1).playWithEther({value: ethers.utils.parseEther('1')});

        await expect(
            kingOfFools.connect(player2).playWithEther({value: ethers.utils.parseEther('1.4')})
        ).to.be.reverted;

        await expect(
            kingOfFools.connect(player2).playWithEther({value: ethers.utils.parseEther('1.5')})
        ).to.be.reverted;

        expect(await kingOfFools.currentKingOfFools()).to.equal(player1.address);
    });

    it('should make player2 king if he deposits more USDC than player1', async function () {
        await usdcContract.connect(player1).approve(kingOfFools.address, parseUSDC(20));
        await kingOfFools.connect(player1).playWithUSDC(parseUSDC(20));

        await usdcContract.connect(player2).approve(kingOfFools.address, parseUSDC(40));
        await kingOfFools.connect(player2).playWithUSDC(parseUSDC(40));

        expect(await kingOfFools.currentKingOfFools()).to.equal(player2.address);
    });

    it('should reject player2 if he deposits less or equal than 1.5x the USDC player1 deposited and player1 should still be king', async function () {
        await usdcContract.connect(player1).approve(kingOfFools.address, parseUSDC(20));
        await kingOfFools.connect(player1).playWithUSDC(parseUSDC(20));

        await usdcContract.connect(player2).approve(kingOfFools.address, parseUSDC(30));
        await expect(
            kingOfFools.connect(player2).playWithUSDC(parseUSDC(29))
        ).to.be.reverted;
        await expect(
            kingOfFools.connect(player2).playWithUSDC(parseUSDC(30))
        ).to.be.reverted;

        expect(await kingOfFools.currentKingOfFools()).to.equal(player1.address);
    });

    it('should transfer player1 the ETH player2 deposits to become king', async function () {
        await kingOfFools.connect(player1).playWithEther({value: ethers.utils.parseEther('1')});

        const balanceOfPlayer1 = await ethers.provider.getBalance(player1.address);

        await kingOfFools.connect(player2).playWithEther({value: ethers.utils.parseEther('2')});

        const balanceOfPlayer1AfterPlayer2BecomesKing = await ethers.provider.getBalance(player1.address);

        expect(balanceOfPlayer1AfterPlayer2BecomesKing.sub(balanceOfPlayer1).eq(ethers.utils.parseEther('2')));
    });


    it('should transfer player1 the USDC player2 deposits to become king', async function () {
        await usdcContract.connect(player1).approve(kingOfFools.address, parseUSDC(20));
        await kingOfFools.connect(player1).playWithUSDC(parseUSDC(20));

        const balanceOfPlayer1 = await usdcContract.balanceOf(player1.address);

        await usdcContract.connect(player2).approve(kingOfFools.address, parseUSDC(40));
        await kingOfFools.connect(player2).playWithUSDC(parseUSDC(40));

        const balanceOfPlayer1AfterPlayer2BecomesKing = await usdcContract.balanceOf(player1.address);

        expect(balanceOfPlayer1AfterPlayer2BecomesKing.sub(balanceOfPlayer1).eq(parseUSDC(20)));
    });

    it('should make player2 king if he deposits more USDC than the ETH player1 deposited, and player1 receives the deposit', async function () {
        const usdcBalanceOfPlayer1 = await usdcContract.balanceOf(player1.address);

        await kingOfFools.connect(player1).playWithEther({value: ethers.utils.parseEther('1')});

        const amountUsdc = ethers.utils.parseEther('1.6').mul(parseUSDC(1)).div(USDC_TO_WEI);

        await usdcContract.connect(player2).approve(kingOfFools.address, amountUsdc);
        await kingOfFools.connect(player2).playWithUSDC(amountUsdc);

        const balanceOfPlayer1AfterPlayer2BecomesKing = await usdcContract.balanceOf(player1.address);

        expect(await kingOfFools.currentKingOfFools()).to.equal(player2.address);
        expect(balanceOfPlayer1AfterPlayer2BecomesKing.sub(usdcBalanceOfPlayer1).eq(amountUsdc));
    });

    it('should make player2 king if he deposits more ETH than the USDC player1 deposited, and player1 receives the deposit', async function () {
        const ethBalanceOfPlayer1 = await ethers.provider.getBalance(player1.address);

        const player1Deposit = parseUSDC(15);
        await usdcContract.connect(player1).approve(kingOfFools.address, player1Deposit);
        await kingOfFools.connect(player1).playWithUSDC(player1Deposit);

        const amountETH = ethers.BigNumber.from(31).mul(USDC_TO_WEI);

        await kingOfFools.connect(player2).playWithEther({value: amountETH});

        const ethBalanceOfPlayer1AfterPlayer2BecomesKing = await ethers.provider.getBalance(player1.address);

        expect(await kingOfFools.currentKingOfFools()).to.equal(player2.address);
        expect(ethBalanceOfPlayer1AfterPlayer2BecomesKing.sub(ethBalanceOfPlayer1).eq(amountETH));
    });

    it('should make player3 king after he deposits more than player2, that deposited more than player 1', async function () {
        const player1Deposit = parseUSDC(15);
        await usdcContract.connect(player1).approve(kingOfFools.address, player1Deposit);
        await kingOfFools.connect(player1).playWithUSDC(player1Deposit);

        const amountETH = ethers.BigNumber.from(31).mul(USDC_TO_WEI);

        await kingOfFools.connect(player2).playWithEther({value: amountETH});

        const usdcBalanceOfPlayer2 = await usdcContract.balanceOf(player2.address);

        const amountUsdc = parseUSDC(47);

        await usdcContract.connect(player3).approve(kingOfFools.address, amountUsdc);
        await kingOfFools.connect(player3).playWithUSDC(amountUsdc);

        const balanceOfPlayer2AfterPlayer3BecomesKing = await usdcContract.balanceOf(player2.address);

        expect(await kingOfFools.currentKingOfFools()).to.equal(player3.address);
        expect(balanceOfPlayer2AfterPlayer3BecomesKing.sub(usdcBalanceOfPlayer2).eq(amountUsdc));
    });

    it('should test close-call', async function () {
        const player1ETH = ethers.BigNumber.from('11298400000000543'); //~ 15 USDC
        await kingOfFools.connect(player1).playWithEther({value: player1ETH});

        const amountUsdc = player1ETH.mul(3).div(2).mul(parseUSDC(1)).div(USDC_TO_WEI).add(1);

        await usdcContract.connect(player2).approve(kingOfFools.address, amountUsdc);
        await kingOfFools.connect(player2).playWithUSDC(amountUsdc);

        expect(await kingOfFools.currentKingOfFools()).to.equal(player2.address);
    });

    it('should revert if players try to play when they are already the king of fools', async function () {
        await kingOfFools.connect(player1).playWithEther({value: ethers.utils.parseEther('1')});

        await expect(
            kingOfFools.connect(player1).playWithEther({value: ethers.utils.parseEther('1.6')})
        ).to.be.reverted;

        const amountUsdc = ethers.utils.parseEther('1.6').mul(parseUSDC(1)).div(USDC_TO_WEI);
        await usdcContract.connect(player1).approve(kingOfFools.address, amountUsdc);

        await expect(
            kingOfFools.connect(player1).playWithUSDC(amountUsdc)
        ).to.be.reverted;
    });
});
