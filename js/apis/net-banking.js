import {validateAndCallbackify, getMerchantAccessKey, getAppData, setAppData, isV3Request, isUrl} from "./../utils";
import {baseSchema} from "./../validation/validation-schema";
import cloneDeep from "lodash/cloneDeep";
import {handlersMap, getConfig, setConfig} from "../config";
import {custFetch} from "../interceptor";
import {getCancelResponse, refineMotoResponse} from "./response";
import {singleHopDropOutFunction} from "./singleHop";
import {TRACKING_IDS, PAGE_TYPES} from "../constants";
import {handleDropIn, openPopupWindowForDropIn, handleOlResponse} from "./drop-in";
import {getDpTokenFromAppData} from "./dynamic-pricing";
let cancelApiResp;
let requestOrigin;
const NBAPIFunc = (confObj, apiUrl) => {
    //if(getAppData('net_banking')) confObj.offerToken = getAppData('net_banking')['offerToken'];
    let offerToken = getDpTokenFromAppData({issuerId:confObj.paymentDetails.bankCode});
    if(offerToken)
        confObj.offerToken = offerToken;
    requestOrigin = confObj.requestOrigin ||TRACKING_IDS.CitrusGuest;
    const reqConf = Object.assign({}, confObj, {
        amount: {
            currency: 'INR',
            value: confObj.amount
        },
        paymentToken: {
            type: 'paymentOptionToken',
            paymentMode: {
                type: 'netbanking',
                code: confObj.paymentDetails.bankCode
            }
        },
        merchantAccessKey: getMerchantAccessKey(confObj),
        requestOrigin: confObj.requestOrigin || TRACKING_IDS.CitrusGuest
    });
    delete reqConf.bankCode;
    delete reqConf.currency;
    delete reqConf.paymentDetails;
    const mode = (reqConf.mode) ? reqConf.mode.toLowerCase() : "";
    delete reqConf.mode;
    let isOl = (getConfig().isOlEnabled === 'true') || (getConfig().isOlEnabled && getConfig().isOlEnabled !== 'false');
    //env.toLowerCase().contains('ol') ?  isOl = true :  isOl = false;
    cancelApiResp = getCancelResponse(reqConf);
    setConfig({cancelApiResp});
    //var winRef = openPopupWindow("");
    //var winRef = window.open("",'PromoteFirefoxWindowName', 'scrollbars=yes, top= 1000, left= 1000 ,visible=none;');
    //if (mode === 'dropout' || getConfig().page === PAGE_TYPES.ICP) {
    //} else {
    if (mode === 'dropin' && getConfig().page !== PAGE_TYPES.ICP) {
        reqConf.returnUrl = getConfig().dropInReturnUrl;
        winRef = openPopupWindowForDropIn(winRef);
    }
    if (getConfig().page === PAGE_TYPES.ICP) {
        return custFetch(apiUrl, {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reqConf)
        });
    }
    else {
        return custFetch(apiUrl, {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reqConf)
        }).then(function (resp) {
            handlePayment(resp.data, mode);
        });
    }
};

let winRef = null;

const netBankingValidationSchema = Object.assign(cloneDeep(baseSchema), {
    paymentDetails: {
        presence: true,
        keysCheck: ['paymentMode', 'bankCode']
    },
    "paymentDetails.bankCode": {presence: true}
});

netBankingValidationSchema.mainObjectCheck.keysCheck.push('paymentDetails');


const makeNetBankingPayment = validateAndCallbackify(netBankingValidationSchema, (confObj) => {
    let isOl = (getConfig().isOlEnabled === 'true') || (getConfig().isOlEnabled && getConfig().isOlEnabled !== 'false');
    let apiUrl;
    isOl ? apiUrl = `${getConfig().olUrl}/${getConfig().vanityUrl}` : apiUrl = `${getConfig().motoApiUrl}/${getConfig().vanityUrl}`;
    //isOl ? const apiUrl = `${getConfig().olUrl}/${getConfig().vanityUrl}` : const apiUrl = `${getConfig().motoApiUrl}/${getConfig().vanityUrl}`;
    return NBAPIFunc(confObj, apiUrl);
});
//wrapper function call
const netbanking = validateAndCallbackify(netBankingValidationSchema, (confObj) => {
    const apiUrl = `${getConfig().motoApiUrl}/${getConfig().vanityUrl}`;
    return NBAPIFunc(confObj, apiUrl);
});

//------------------- makeBlazeNBPayment ----------------//

const makeBlazeNBPayment = validateAndCallbackify(netBankingValidationSchema, (confObj) => {
    const apiUrl = `${getConfig().motoApiUrl}/moto/authorize/struct/${getConfig().vanityUrl}`;
    return NBAPIFunc(confObj, apiUrl);
});

//------------------- makeSavedNBPayment ----------------//

const savedNBValidationSchema = Object.assign(cloneDeep(baseSchema), {
    token: {presence: true}
});

savedNBValidationSchema.mainObjectCheck.keysCheck.push('token');

const savedAPIFunc = (confObj, url) => {
    setAppData('paymentObj',confObj);
    //if(getAppData('citrus_wallet')) confObj.offerToken = getAppData('citrus_wallet')['offerToken'];
     let offerToken = getDpTokenFromAppData({token:confObj.token});
    if(offerToken)
        confObj.offerToken = offerToken;
    requestOrigin = confObj.requestOrigin || TRACKING_IDS.CitrusWallet;
    const reqConf = Object.assign({}, confObj, {
        amount: {
            currency: confObj.currency,
            value: confObj.amount
        },
        paymentToken: {
            type: 'paymentOptionIdToken',
            id: confObj.token
        },
        merchantAccessKey: getMerchantAccessKey(confObj),
        requestOrigin: confObj.requestOrigin || TRACKING_IDS.CitrusWallet
    });

    confObj.CVV && (reqConf.paymentToken.cvv = confObj.CVV);

    delete reqConf.currency;
    delete reqConf.token;
    delete reqConf.CVV;
    const mode = (reqConf.mode) ? reqConf.mode.toLowerCase() : "";
    delete reqConf.mode;
    if (mode === 'dropin' && getConfig().page !== PAGE_TYPES.ICP ) {
        reqConf.returnUrl = getConfig().dropInReturnUrl;
        if(getConfig().page!== PAGE_TYPES.HOSTED_FIELD)
            winRef = openPopupWindowForDropIn(winRef);
        
    }
    let isOl = (getConfig().isOlEnabled === 'true') || (getConfig().isOlEnabled && getConfig().isOlEnabled !== 'false');
    let apiUrl;
    isOl ? apiUrl = `${getConfig().olUrl}/${getConfig().vanityUrl}` : apiUrl = `${getConfig().motoApiUrl}/${getConfig().vanityUrl}`;
    if (getConfig().page === PAGE_TYPES.ICP) {
        return custFetch(apiUrl, {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reqConf)
        });
    }
    else {
        return custFetch(apiUrl, {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reqConf)
        }).then(function (resp) {
            if (getConfig().page !== PAGE_TYPES.ICP) {
                if(getConfig().page!== PAGE_TYPES.HOSTED_FIELD)
                    handlePayment(resp.data,mode);
                else
                    return resp;
            }
        });
    }
};
const handlePayment = (resp,mode)=>{
    if (resp.redirectUrl) {
        if (mode === "dropout") {
            // isV3Request(requestOrigin)?window.location = resp.redirectUrl:singleHopDropOutFunction(resp.redirectUrl);
            if (isV3Request(requestOrigin)) {
                let htmlStr = resp.redirectUrl.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                if (isUrl(htmlStr) && !(getConfig().isSingleHop)) {
                    window.location = resp.redirectUrl;
                    return;
                }
                isUrl(htmlStr) ? singleHopDropOutFunction(htmlStr) : handleOlResponse(htmlStr);
            }
            else {
                singleHopDropOutFunction(resp.redirectUrl);
            }
        }
        else {
                handleDropIn(resp,winRef);
            }
    } else {
        if (winRef) {
            winRef.close();
        }
        const response = refineMotoResponse(resp);
        handlersMap['serverErrorHandler'](response);
    }
};

const makeSavedNBPayment = (paymentObj)=>{
    let paymentData = cloneDeep(paymentObj);
    if(paymentObj.paymentDetails){
        if(!paymentObj.token && paymentObj.paymentDetails.token)
            paymentData.token = paymentObj.paymentDetails.token;
        delete paymentData.paymentDetails;
    }
    let makeSavedNBPaymentInternal = validateAndCallbackify(savedNBValidationSchema, (confObj)=> {
    const apiUrl = `${getConfig().motoApiUrl}/${getConfig().vanityUrl}`;
    return savedAPIFunc(confObj, apiUrl);
    });
    return makeSavedNBPaymentInternal(paymentData);
};

export {
    makeNetBankingPayment,
    makeSavedNBPayment,
    makeBlazeNBPayment,
    savedAPIFunc,
    savedNBValidationSchema,
    netbanking
}