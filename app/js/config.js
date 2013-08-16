var configModule = angular.module('tbApp.config', []);

configModule.constant('FIREBASE_URL', 'https://travelbids.firebaseio.com/');
configModule.constant('COUNT_DOWN_INTERVAL', 1000);
configModule.constant('AUCTION_VERIFY_CONDITION', -3 * 1000);
configModule.constant('AUCTION_FINISHED_CONDITION', -5 * 1000);
