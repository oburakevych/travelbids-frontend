'use strict';

/* Services */
var servicesModule = angular.module('tbApp.services', []);

servicesModule.factory('firebaseReference', ['$firebase', 'FIREBASE_URL', function($firebase, FIREBASE_URL) {
		var instance = new Firebase(FIREBASE_URL);
      	return {
      		getInstance: function() {
      			return instance;
      		}
      	}
}]);
