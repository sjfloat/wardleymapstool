/* Copyright 2015 and Scott Weinstein and Krzysztof Daniel.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

var config = {
    userProvider : 'stormpath'
};
try {
    config = require('../config.json');
} catch (ex) {

}

module.exports = function(app) {
    if (config.userProvider === 'stormpath') {
        var stormpathconfig = require('./config/stormpathconfig').stormpathconfig;
        var googleauth = require('./config/googleauth').googleauth;
        var stormpath = require('express-stormpath');
        var user = new require('./user')();

        app.use(stormpath.init(app, {
            apiKeyId : stormpathconfig.getApiKeyId(),
            apiKeySecret : stormpathconfig.getApiKeySecret(),
            secretKey : stormpathconfig.getSecretKey(),
            application : stormpathconfig.getApplication(),
            postRegistrationHandler : function(account, res, next) {
                user.processLoginInfo(account, res, next);
            },
            enableGoogle : true,
            social : {
                google : {
                    clientId : googleauth.getClientID(),
                    clientSecret : googleauth.getClientSecret(),
                },
            },
            expandProviderData : true,
            expandCustomData : true
        }));

        return stormpath;
    }

    if (config.userProvider === 'os') {
        console.log('WARNING : development mode');
        console.log('WARNING : auth disabled');
        function osUserMiddleware(req, res, next) {
            req.user = {
                href : process.env.USER || process.env.USERNAME
            };
            next();
        }
        osUserMiddleware.loginRequired = function(req, res, next) {
            next();
        }
        app.use(osUserMiddleware);
        return osUserMiddleware;
    }

    var someOtherProvider = require(config.userProvider);
    app.use(someOtherProvider);
    return someOtherProvider;
}
