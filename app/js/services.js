'use strict';

/* Services */
var servicesModule = angular.module('tbApp.services', []);

servicesModule.factory('firebaseReference', ['$firebase', 'FIREBASE_URL', function($firebase, FIREBASE_URL) {
	console.log("new Firebase(FIREBASE_URL)");
	return new Firebase(FIREBASE_URL);
}]);
