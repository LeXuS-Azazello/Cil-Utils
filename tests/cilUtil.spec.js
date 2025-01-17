'use strict';

const {describe, it} = require('mocha');
const chai = require('chai');
const sinon = require('sinon');
const CilUtils = require('../cilUtils');
const chaiProm = require('chai-as-promised');

chai.use(chaiProm);
const {assert} = chai;

let utils;

describe('CilUtils', () => {
  before(async function() {
    this.timeout(15000);
  });

  after(async function() {
    this.timeout(15000);
  });

  beforeEach(async function() {
    this.timeout(15000);
    utils = new CilUtils({
      privateKey: '15716ac92ee51909286fb51cd2d600bbedbdf85b675e9bca60067689d7b0f27c',
      nFeePerInputOutput: 250,
      nFeeDeploy: 1e4,
      rpcPort: 18222,
      rpcAddress: 'localhost',
      apiUrl: 'dummy'
    });
  });

  it('should create class', async () => {
    assert.isOk(utils);
  });

  it('should getUtxos', async () => {
    utils.queryApi = sinon.fake.resolves([
      {
        "hash": "13252b7f61784f4d45740c38b4bbf15629e066b198c70b54a05af6f006b5b6c2",
        "nOut": 1,
        "amount": 499986000,
        "isStable": true
      },
      {
        "hash": "21e8bdbee170964d36fcabe4e071bc14933551b9c2b031770ce73ba973bc4dd7",
        "nOut": 1,
        "amount": 499986000,
        "isStable": true
      }]
    );

    const result = await utils.getUtxos('test');
    assert.isOk(Array.isArray(result));
    assert.equal(result.length, 2);
  });

  describe('gatherInputsForAmount', () => {
    let arrUtxos;
    const amount = 499986000;

    beforeEach(() => {
      arrUtxos = [
        {
          "hash": "13252b7f61784f4d45740c38b4bbf15629e066b198c70b54a05af6f006b5b6c2",
          "nOut": 1,
          "amount": amount,
          "isStable": true
        },
        {
          "hash": "21e8bdbee170964d36fcabe4e071bc14933551b9c2b031770ce73ba973bc4dd7",
          "nOut": 1,
          "amount": amount,
          "isStable": true
        }];
    });
    it('should use one utxo (fee)', async () => {
      const {arrCoins, gathered} = utils.gatherInputsForAmount(arrUtxos, amount / 2);

      assert.equal(arrCoins.length, 1);
      assert.equal(gathered, amount);
    });

    it('should use both utxo (fee)', async () => {
      const {arrCoins, gathered} = utils.gatherInputsForAmount(arrUtxos, amount);

      assert.equal(arrCoins.length, 2);
      assert.equal(gathered, 2 * amount);
    });

    it('should throw (fee)', async () => {
      assert.throws(() => utils.gatherInputsForAmount(arrUtxos, 2 * amount), 'Not enough coins!');
    });
  });

  describe('waitTxDone', async () => {
    let clock;
    beforeEach(async function() {
      this.timeout(15000);
      utils = new CilUtils({
        privateKey: '15716ac92ee51909286fb51cd2d600bbedbdf85b675e9bca60067689d7b0f27c',
        nFeePerInputOutput: 250,
        nFeeDeploy: 1e4,
        rpcPort: 18222,
        rpcAddress: 'localhost',
        apiUrl: 'https://test-explorer.ubikiri.com/api/'
      });
    });

    afterEach(async () => {
    });

    it('should fail (isTxDoneExplorer) for contract call', async () => {
      utils._explorerHasUtxo = sinon.fake();

      const objFakeTx = {
        "status": "stable",
        "block": "db4b82533bbe91be8afed47e9570b34f940b8cbb9810dddb8e3e0611894e352e",
        "tx": {
          "claimProofs": [],
          "payload": {
            "version": 1,
            "сonciliumId": 1,
            "ins": [{"txHash": "6de6185cfd62d779c535b790821fc72651cd34e74a5aea3ed0d75cb17478fdc5", "nTxOutput": 0}],
            "outs": [
              {
                "intTx": [],
                "tokenTransfer": null
              }]
          }
        }
      };

      utils.queryApi = sinon.fake.resolves(objFakeTx);

      const result = await utils.isTxDoneExplorer('fake', true);

      assert.isNotOk(result);
    });

    it('should success (isTxDoneExplorer) for contract call', async () => {
      utils._explorerHasUtxo = sinon.fake();

      const objFakeTx = {
        "status": "stable",
        "block": "0e492eccb2ea937ccf9df3de02ba4395a7223569c7221d80295497040254509e",
        "tx": {
          "claimProofs": [],
          "payload": {
            "version": 1,
            "сonciliumId": 1,
            "outs": [
              {
                "intTx": [
                  {
                    "intTxHash": "dea14d1a4b9f6641d5df2fae1f67354bc8e6b5574daebcac60d12f981f05fac7",
                    "status": "ok",
                    "message": ""
                  }
                ]
              }
            ]
          }
        }
      };

      utils.queryApi = sinon.fake.resolves(objFakeTx);

      const result = await utils.isTxDoneExplorer('fake', true);

      assert.isOk(result);
      assert.equal(utils._explorerHasUtxo.callCount, 0);
    });

    it('should fail (isTxDoneExplorer)', async () => {
      utils.queryApi = sinon.fake.throws({"error": "tx not found"});

      const result = await utils.isTxDoneExplorer('1194c8c152fd6b13f9d34ded6b30f03680db2a90e5f2561d451a84b5d593672f');

      assert.isNotOk(result);
    });

    it('should waitTxDone', async () => {
      let nAttempt = 3;
      utils._client = {
        request: async () => {
          if (!--nAttempt) return {result: {status: 'confirmed'}};
          return {result: {}};
        }
      };
      utils._sleep = async () => {};

      await utils.waitTxDone('fakeHash');
    });

    it('should waitTxDone (contract)', async () => {
      let nAttempt = 3;
      utils._client = {
        request: async () => {
          if (!--nAttempt) return {result: {status: 1}};
          return {result: {}};
        }
      };
      utils._sleep = async () => {};

      await utils.waitTxDone('fakeHash', 400, true);
    });

    it('should waitTxDoneExplorer', async () => {
      let nAttempt = 3;
      utils._explorerHasUtxo = sinon.fake.resolves(true);
      utils.isTxDoneExplorer = async () => {
        if (!--nAttempt) {
          return true;
        }
        return false;
      };
      utils._sleep = async () => {console.log('Fake sleep');};

      await utils.waitTxDoneExplorer('fakeHash');
    });

    it('should fail waitTxDoneExplorer', async () => {
      utils._explorerHasUtxo = sinon.fake.resolves(true);
      utils.isTxDoneExplorer = async () => {
        return false;
      };
      utils._sleep = async () => {console.log('Fake sleep');};

      try {
        await utils.waitTxDoneExplorer('fakeHash');
      } catch (e) {
        return;
      }

      assert('Unexpected success');
    });
  });

  it('should createTxWithFunds (two input and change)', async () => {
    const amount = 499986000;
    const nOutputs = 20;
    const arrCoins = [
      {
        "hash": "13252b7f61784f4d45740c38b4bbf15629e066b198c70b54a05af6f006b5b6c2",
        "nOut": 1,
        "amount": amount,
        "isStable": true
      },
      {
        "hash": "21e8bdbee170964d36fcabe4e071bc14933551b9c2b031770ce73ba973bc4dd7",
        "nOut": 1,
        "amount": amount,
        "isStable": true
      }];

    const tx = await utils.createTxWithFunds({
      arrCoins,
      gatheredAmount: arrCoins.reduce((accum, current) => accum += current.amount, 0),
      receiverAddr: 'Ux1ac4cfe96bd4e2a3df3d5115b75557b9f05d4b86',
      amount,
      nOutputs: 20,
      manualFee: 1
    });

    assert.isOk(tx);
    assert.equal(tx.inputs.length, 2);
    assert.equal(tx.outputs.length, nOutputs + 1);
  });

  it('should createTxWithFunds (two receivers and change)', async () => {
    const amount = 1e4;
    const nOutputs = 2;
    const manualFee = 100;
    const arrCoins = [
      {
        "hash": "13252b7f61784f4d45740c38b4bbf15629e066b198c70b54a05af6f006b5b6c2",
        "nOut": 1,
        "amount": amount,
        "isStable": true
      },
      {
        "hash": "21e8bdbee170964d36fcabe4e071bc14933551b9c2b031770ce73ba973bc4dd7",
        "nOut": 1,
        "amount": amount,
        "isStable": true
      }];

    const tx = await utils.createTxWithFunds({
      arrCoins,
      gatheredAmount: arrCoins.reduce((accum, current) => accum + current.amount, 0),
      nOutputs,
      manualFee,
      arrReceivers: [
        ['Ux1ac4cfe96bd4e2a3df3d5115b75557b9f05d4b86', amount / 2],
        ['Ux00c4cfe96bd4e2a3df3d5115b75557b9f05d4b00', amount]
      ]
    });

    assert.isOk(tx);
    assert.equal(tx.inputs.length, 2);
    assert.equal(tx.outputs.length, 2 * nOutputs + 1);

    // it exclude change
    assert.equal(tx.amountOut(), 2 * amount - manualFee);
  });

  it('should createTxWithFunds (two receivers NO change)', async () => {
    const amount = 1e4;
    const nOutputs = 2;
    const nManualFee = 1000;
    const arrCoins = [
      {
        "hash": "13252b7f61784f4d45740c38b4bbf15629e066b198c70b54a05af6f006b5b6c2",
        "nOut": 1,
        "amount": amount,
        "isStable": true
      },
      {
        "hash": "21e8bdbee170964d36fcabe4e071bc14933551b9c2b031770ce73ba973bc4dd7",
        "nOut": 1,
        "amount": amount,
        "isStable": true
      }];

    const tx = await utils.createTxWithFunds({
      arrCoins,
      gatheredAmount: arrCoins.reduce((accum, current) => accum + current.amount, 0),
      nOutputs,
      manualFee: nManualFee,
      arrReceivers: [
        ['Ux1ac4cfe96bd4e2a3df3d5115b75557b9f05d4b86', amount - nManualFee],
        ['Ux00c4cfe96bd4e2a3df3d5115b75557b9f05d4b00', amount]
      ]
    });

    assert.isOk(tx);
    assert.equal(tx.inputs.length, 2);
    assert.equal(tx.outputs.length, 2 * nOutputs);

    // it exclude change
    assert.equal(tx.amountOut(), 2 * amount - nManualFee);
  });

//  it('should createTxInvokeContract', async () => {
//    utils.queryApi = sinon.fake.resolves([
//      {
//        "hash": "13252b7f61784f4d45740c38b4bbf15629e066b198c70b54a05af6f006b5b6c2",
//        "nOut": 1,
//        "amount": 499986000,
//        "isStable": true
//      },
//      {
//        "hash": "21e8bdbee170964d36fcabe4e071bc14933551b9c2b031770ce73ba973bc4dd7",
//        "nOut": 1,
//        "amount": 499986000,
//        "isStable": true
//      }]
//    );
//
//    const tx = await utils.createTxInvokeContract(
//      'Ux1ac4cfe96bd4e2a3df3d5115b75557b9f05d4b86',
//      {
//        method: 'method',
//        arrArguments: []
//      }
//    );
//    assert.isOk(tx);
//    assert.equal(tx.inputs.length, 1);
//    assert.equal(tx.outputs.length, 1);
//  });

  it('should successfully send tx', async () => {
    utils._client.request = sinon.fake.resolves({result: 'some data'});
    const fakeTx = {encode: () => 'fake', getHash: () => 'fakeHash'};
    await utils.sendTx(fakeTx);
  });

  it('should FAIL to send tx', async () => {
    utils._client.request = sinon.fake.resolves({error: 'some error'});
    const fakeTx = {encode: () => 'fake'};
    return assert.isRejected(utils.sendTx(fakeTx));
  });

  it('should get "result" from response for getUtxos', async () => {
    const result = 'some data';
    utils.queryApi = sinon.fake.resolves(result);
    const res = await utils.getUtxos();
    assert.equal(res, result);
  });

  it('should FAIL to get getUtxos', async () => {
    utils._client.request = sinon.fake.resolves({error: 'some error'});
    return assert.isRejected(utils.getUtxos());
  });

});
