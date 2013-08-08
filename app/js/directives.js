'use strict';

/* Directives */


var directivesModule = angular.module('myApp.directives', []);

directivesModule.directive('appVersion', ['version', function(version) {
    return function(scope, elm, attrs) {
      elm.text(version);
    };
}]);

directivesModule.directive('tbAuction', [function() {
	return {
		restrict: 'A, E',
		scope: {
			auctionId: "@tbAuctionId"
		},
		templateUrl: 'views/auction.html'
	};
}]);

directivesModule.directive('tbLogin', [function() {
	return {
		restrict: 'A, E',
		templateUrl: 'views/login.html'
	};
}]);