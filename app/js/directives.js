'use strict';

/* Directives */


var directivesModule = angular.module('tbApp.directives', []);

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