import { useState, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { ethers } from "ethers";
import { Biconomy } from "@biconomy/mexa";
const inter = Inter({ subsets: ["latin"] });
import ABI from "../Abi.json";

export default function Home() {
  const [count, setCount] = useState(0);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const addr = "0x5243E2d619914e71a6A820428E0291946C276fa6";
  const [ctr, setCtr] = useState(null);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [meta, setMeta] = useState(false);
  const [biconomy, setBiconomy] = useState(null);

  const createContract = async () => {
    if (!window.ethereum) return;
    console.log("creating contract");
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);
    setSigner(provider.getSigner());
    console.log("signer", provider.getSigner());
    initBiconomy(provider.getSigner());
    provider.send("eth_requestAccounts", []).then((accounts) => {
      if (accounts.length > 0) setCurrentAccount(accounts[0]);
    });
    let contract = new ethers.Contract(addr, ABI, provider.getSigner());
    setCtr(contract);
    console.log("created contract");
    let count = await contract.counter();
    console.log("count", count.toString());
  };

  const initBiconomy = async (s) => {
    if (s.provider) {
      try {
        console.log("Initializing Biconomy ...");

        let biconomy = new Biconomy(s.provider, {
          apiKey: "K-noYba8u.d36f0e0a-8d24-4fc6-b4ad-7720cca6b93b",
          contractAddresses: addr,
          debug: true,
        });

        await biconomy.init();

        setBiconomy(biconomy);

        setMeta(true);
        console.log("biconomy", biconomy);
        console.log("initialized biconmy");
      } catch (error) {
        console.log("biconomy error", error);
      }
    }
  };

  const sendMeta = async () => {
    if (!meta || !ctr) return;
    console.log("sending meta");
    const domainType = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
    ];
    const metaTransactionType = [
      { name: "nonce", type: "uint256" },
      { name: "from", type: "address" },
      { name: "functionSignature", type: "bytes" },
    ];
    let domainData = {
      name: "LOMADS-SBT",
      version: "2",
      verifyingContract: addr,
      salt: "0x" + (80001).toString(16).padStart(64, "0"),
    };

    let nonce = await ctr.getNonce(currentAccount);
    console.log("nonce", nonce.toString());

    let amount = ethers.utils.parseUnits("1", 18);
    console.log("amount", amount.toString());

    const contractInterface = new ethers.utils.Interface(ABI);
    let functionSignature = contractInterface.encodeFunctionData(
      "deployNewSBT",
      [
        "first",
        "FST",
        amount,
        "0x7564D723f91168b0e5AAf16B4Ce3603e6c28868A",
        currentAccount,
        false,
      ]
    );

    let message = {
      nonce: parseInt(nonce),
      from: currentAccount,
      functionSignature: functionSignature,
    };

    const dataToSign = JSON.stringify({
      types: {
        EIP712Domain: domainType,
        MetaTransaction: metaTransactionType,
      },
      domain: domainData,
      primaryType: "MetaTransaction",
      message: message,
    });

    let signature = await provider.send("eth_signTypedData_v3", [
      currentAccount,
      dataToSign,
    ]);

    let { r, s, v } = getSignatureParametersEthers(signature);
    sendSignedTransaction(currentAccount, functionSignature, r, s, v);
  };

  const getSignatureParametersEthers = (signature) => {
    if (!ethers.utils.isHexString(signature)) {
      throw new Error(
        'Given value "'.concat(signature, '" is not a valid hex string.')
      );
    }
    const r = signature.slice(0, 66);
    const s = "0x".concat(signature.slice(66, 130));
    let v = "0x".concat(signature.slice(130, 132));
    v = ethers.BigNumber.from(v).toString();
    if (![27, 28].includes(Number(v))) v += 27;
    return {
      r: r,
      s: s,
      v: Number(v),
    };
  };

  const sendSignedTransaction = async (userAddress, functionData, r, s, v) => {
    try {
      console.log(`Sending transaction via Biconomy`);

      let provider = biconomy.provider;
      const contractInstance = new ethers.Contract(
        addr,
        ABI,
        biconomy.ethersProvider
      );
      let { data } =
        await contractInstance.populateTransaction.executeMetaTransaction(
          userAddress,
          functionData,
          r,
          s,
          v
        );
      let txParams = {
        data: data,
        to: addr,
        from: currentAccount,
        signatureType: "EIP712_SIGN",
      };
      const tx = await provider.send("eth_sendTransaction", [txParams]);
      console.log(tx);
      biconomy.on("txHashGenerated", (data) => {
        console.log(data);
        showSuccessMessage(`tx hash ${data.hash}`);
      });
      biconomy.on("txMined", (data) => {
        console.log(data);
        showSuccessMessage(`tx mined ${data.hash}`);
        fetchQuote();
      });
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      createContract();
    }
  }, []);

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        hello {currentAccount}
        <button
          onClick={() => {
            sendMeta();
          }}
        >
          click
        </button>
      </main>
    </>
  );
}
