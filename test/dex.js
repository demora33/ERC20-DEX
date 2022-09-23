const { expectThrow } = require("@daonomic/tests-common");
const Dex = artifacts.require("mocks/Dex.sol");
const Dai = artifacts.require("mocks/Dai.sol");
const Bat = artifacts.require("mocks/Bat.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Rep = artifacts.require("mocks/Rep.sol");

contract("Dex", (accounts) => {
  let dai, bat, rep, zrx, dex;

  let buyOrders, sellOrders;

  const [trader1, trader2] = [accounts[1], accounts[2]];

  const [DAI, BAT, REP, ZRX] = ["DAI", "BAT", "REP", "ZRX"].map((symbol) =>
    web3.utils.fromAscii(symbol)
  );

  const SIDE = {
    BUY: 0,
    SELL: 1,
  };

  beforeEach(async () => {
    //Deployeamos contratos ERC20
    [dai, bat, rep, zrx] = await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new(),
    ]);

    //Deployeamos exchange
    dex = await Dex.new();

    //Añadimos tokens al exchange (solo puede añadir el admin)
    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(BAT, bat.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address),
    ]);

    //Transferimos 100 unidades de cada token a cada usuario y damos permiso al exchange para que utilice dicha cantidad
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

  it("should NOT deposit tokens if token does not exist", async () => {
    await expectThrow(
      dex.deposit(
        web3.utils.toWei("100"),
        web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"),
        { from: trader1 }
      ),
      "This token does not exist"
    );
  });

  it("should withdraw the correct amount of tokens", async () => {
    const amount = await web3.utils.toWei("100");

    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await dex.withdraw(amount, DAI, {
      from: trader1,
    });
    const [traderBalance, daiBalance] = await Promise.all([
      dex.traderBalances(trader1, DAI),
      dai.balanceOf(trader1),
    ]);

    assert(traderBalance.isZero());
    assert(daiBalance.toString() === web3.utils.toWei("1000"));
  });

  it("should NOT withdraw tokens if token does not exist", async () => {
    const amount = await web3.utils.toWei("100");

    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await expectThrow(
      dex.withdraw(amount, web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"), {
        from: trader1,
      }),
      "This token does not exist"
    );
  });

  it("should NOT withdraw tokens if there is not enough balance", async () => {
    const amount = await web3.utils.toWei("100");

    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await expectThrow(
      dex.withdraw(amount + 1, DAI, {
        from: trader1,
      }),
      "There is not enough balance to withdraw"
    );
  });

  it("should create limit order", async () => {
    const amount = await web3.utils.toWei("1000");
    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await dex.deposit(amount, DAI, {
      from: trader2,
    });

    await dex.createLimitOrder(ZRX, 10, web3.utils.toWei("10"), SIDE.BUY, {
      from: trader1,
    });

    buyOrders = await dex.getOrders(ZRX, SIDE.BUY);
    sellOrders = await dex.getOrders(ZRX, SIDE.SELL);

    assert(buyOrders.length === 1);
    assert(buyOrders[0].trader === trader1);
    assert(buyOrders[0].amount === "10");
    assert(buyOrders[0].filled === "0");
    assert(buyOrders[0].price === web3.utils.toWei("10"));
    assert(sellOrders.length === 0);

    await dex.createLimitOrder(ZRX, 2, web3.utils.toWei("50"), SIDE.BUY, {
      from: trader2,
    });

    buyOrders = await dex.getOrders(ZRX, SIDE.BUY);
    sellOrders = await dex.getOrders(ZRX, SIDE.SELL);

    assert(buyOrders.length === 2);
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[0].amount === "2");
    assert(buyOrders[0].filled === "0");
    assert(buyOrders[0].price === web3.utils.toWei("50"));
    assert(sellOrders.length === 0);

    await dex.createLimitOrder(ZRX, 10, web3.utils.toWei("100"), SIDE.BUY, {
      from: trader2,
    });

    buyOrders = await dex.getOrders(ZRX, SIDE.BUY);
    sellOrders = await dex.getOrders(ZRX, SIDE.SELL);

    assert(buyOrders.length === 3);
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[0].amount === "10");
    assert(buyOrders[0].filled === "0");
    assert(buyOrders[0].price === web3.utils.toWei("100"));
    assert(sellOrders.length === 0);
  });

  it("should NOT create limit order if token does not exist", async () => {
    const amount = await web3.utils.toWei("1000");
    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await expectThrow(
      dex.createLimitOrder(
        web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"),
        10,
        web3.utils.toWei("10"),
        SIDE.BUY,
        {
          from: trader1,
        }
      ),
      "This token does not exist"
    );
  });

  it("should NOT create limit order if token is DAI", async () => {
    const amount = await web3.utils.toWei("1000");
    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await expectThrow(
      dex.createLimitOrder(DAI, 10, web3.utils.toWei("10"), SIDE.BUY, {
        from: trader1,
      }),
      "No possible to trade with DAI"
    );
  });

  it("should NOT create limit order if there is not enough DAI", async () => {
    const amount = await web3.utils.toWei("1000");
    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await expectThrow(
      dex.createLimitOrder(DAI, 1, web3.utils.toWei("1001"), SIDE.BUY, {
        from: trader1,
      }),
      "Not enough DAI to trade with"
    );
  });

  it("should NOT create limit order if there is not enough token balance", async () => {
    const amount = await web3.utils.toWei("1000");
    await dex.deposit(amount, ZRX, {
      from: trader1,
    });

    await expectThrow(
      dex.createLimitOrder(DAI, 1, web3.utils.toWei("1001"), SIDE.SELL, {
        from: trader1,
      }),
      "Not enough token balance to trade with"
    );
  });

  it("should create market order", async () => {
    const amount = await web3.utils.toWei("100");

    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await dex.deposit(amount, ZRX, {
      from: trader2,
    });

    await dex.createLimitOrder(ZRX, web3.utils.toWei("10"), 10, SIDE.BUY, {
      from: trader1,
    });

    await dex.createMarketOrder(ZRX, web3.utils.toWei("5"), SIDE.SELL, {
      from: trader2,
    });

    const [balance1Dai, balance1Zrx, balance2Dai, balance2Zrx] =
      await Promise.all([
        dex.traderBalances(trader1, DAI),
        dex.traderBalances(trader1, ZRX),
        dex.traderBalances(trader2, DAI),
        dex.traderBalances(trader2, ZRX),
      ]);

    // console.log("balance1Dai", balance1Dai.toString());
    // console.log("balance1Zrx", balance1Zrx.toString());
    // console.log("balance2Dai", balance2Dai.toString());
    // console.log("balance2Zrx", balance2Zrx.toString());

    buyOrders = await dex.getOrders(ZRX, SIDE.BUY);

    assert(buyOrders[0].filled === web3.utils.toWei("5"));
    assert(balance1Dai.toString() === web3.utils.toWei("50"));
    assert(balance1Zrx.toString() === web3.utils.toWei("5"));
    assert(balance2Dai.toString() === web3.utils.toWei("50"));
    assert(balance2Zrx.toString() === web3.utils.toWei("95"));
  });

  it("should NOT create market order if there is not enough DAI", async () => {
    const amount = await web3.utils.toWei("1000");
    await dex.deposit(amount, ZRX, {
      from: trader1,
    });

    await dex.createLimitOrder(ZRX, web3.utils.toWei("100"), 10, SIDE.SELL, {
      from: trader1,
    });

    await expectThrow(
      dex.createMarketOrder(ZRX, web3.utils.toWei("10"), SIDE.BUY, {
        from: trader2,
      }),
      "Not enough DAI to trade with"
    );
  });

  it("should NOT create market order if there is not enough token balance", async () => {
    const amount = await web3.utils.toWei("100");

    await dex.deposit(amount, ZRX, {
      from: trader2,
    });

    await expectThrow(
      dex.createMarketOrder(ZRX, web3.utils.toWei("101"), SIDE.SELL, {
        from: trader2,
      }),
      "Not enough token balance to trade with"
    );
  });

  it("should NOT create market order if token does not exist", async () => {
    await expectThrow(
      dex.createMarketOrder(
        web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"),
        web3.utils.toWei("10"),
        SIDE.BUY,
        {
          from: trader1,
        }
      ),
      "This token does not exist"
    );
  });

  it("should NOT create market order if token is DAI", async () => {
    await expectThrow(
      dex.createMarketOrder(DAI, web3.utils.toWei("10"), SIDE.BUY, {
        from: trader1,
      }),
      "No possible to trade with DAI"
    );
  });
});
