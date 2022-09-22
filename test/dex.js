const Dex = artifacts.require("mocks/Dex.sol");
const Dai = artifacts.require("mocks/Dai.sol");
const Bat = artifacts.require("mocks/Bat.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Rep = artifacts.require("mocks/Rep.sol");

contract("Dex", () => {
  let dai, bat, rep, zrx;

  const [DAI, BAT, REP, ZRX] = ["DAI", "BAT", "REP", "ZRX"].map((ticker) =>
    web3.utils.fromAscii(ticker)
  );

  beforeEach(async () => {
    [dai, bat, rep, zrx] = await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new(),
    ]);

    const dex = await Dex.new();

    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(BAT, bat.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address),
    ]);
  });
});
