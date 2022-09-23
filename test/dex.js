const { expectRevert } = require("@openzeppelin/test-helpers");
const Dex = artifacts.require("mocks/Dex.sol");
const Dai = artifacts.require("mocks/Dai.sol");
const Bat = artifacts.require("mocks/Bat.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Rep = artifacts.require("mocks/Rep.sol");

contract("Dex", (accounts) => {
  let dai, bat, rep, zrx, dex;

  const [trader1, trader2] = [accounts[1], accounts[2]];

  const [DAI, BAT, REP, ZRX] = ["DAI", "BAT", "REP", "ZRX"].map((symbol) =>
    web3.utils.fromAscii(symbol)
  );

  beforeEach(async () => {
    [dai, bat, rep, zrx] = await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new(),
    ]);

    dex = await Dex.new();

    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(BAT, bat.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address),
    ]);

    const amount = web3.utils.toWei("1000");

    const seedTokenBalance = async (token, trader) => {
      await token.faucet(trader, amount);
      await token.approve(dex.address, amount, { from: trader });
    };

    await Promise.all(
      [dai, bat, rep, zrx].map((token) => seedTokenBalance(token, trader1))
    );

    await Promise.all(
      [dai, bat, rep, zrx].map((token) => seedTokenBalance(token, trader2))
    );
  });

  it("should deposit the correct amount of tokens", async () => {
    const amount = await web3.utils.toWei("100");

    await dex.deposit(amount, DAI, {
      from: trader1,
    });
    const balance = await dex.traderBalances(trader1, DAI);
    assert(balance.toString() === amount);
  });

  // it("should NOT deposit tokens if token does not exist", async () => {
  //   await expectRevert(
  //     dex.deposit(
  //       web3.utils.toWei("100"),
  //       web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"),
  //       { from: trader1 }
  //     ),
  //     "This token does not exist"
  //   );
  // });
});
