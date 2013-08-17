'use strict';


// Declare app level module which depends on filters, and services
angular.module('tbApp', ['tbApp.config', 'tbApp.filters', 'tbApp.services', 'tbApp.directives', 'tbApp.controllers', 'firebase']).
  config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/discover', {templateUrl: 'views/discover.html', controller: 'AuctionsDiscoverController'});
    $routeProvider.when('/signup', {templateUrl: 'views/signup.html', controller: 'SignupController'});
    $routeProvider.otherwise({redirectTo: '/discover'});
  }]);
