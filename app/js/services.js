'use strict';

/* Services */
var servicesModule = angular.module('tbApp.services', []);

servicesModule.factory('firebaseReference', ['FIREBASE_URL', function(FIREBASE_URL) {
		var instance = new Firebase(FIREBASE_URL);
      	return {
      		getInstance: function() {
      			if (!instance) {
      				instance = new Firebase(FIREBASE_URL);
      			}
      			return instance;
      		}
      	}
}]);
