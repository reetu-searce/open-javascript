const CREDIT_CARD_GENERATOR_URL = 'http://localhost/cards.php'
const getConfigValue = (key) =>{
    "use strict";
    return CREDIT_CARD_GENERATOR_URL;
}
const validHostedFieldTypes = ["cvv","expiry","cardNumber"];
export {getConfigValue,validHostedFieldTypes};