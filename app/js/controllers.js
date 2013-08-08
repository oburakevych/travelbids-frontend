'use strict';

/* Controllers */

var controllersModule = angular.module('myApp.controllers', []);

var url = 'https://travelbids.firebaseio.com';
var travelBidsFirebaseRef = new Firebase(url);
var COUNT_DOWN_INTERVAL = 1000;
  
controllersModule.controller('AuctionsDiscoverController', ['$rootScope', '$scope', 'angularFire', '$timeout', '$filter', 
	function($rootScope, $scope, angularFire, $timeout, $filter) {
		$scope.auctionsDiscoveryPromise = angularFire(travelBidsFirebaseRef + "/auctionlist", $scope, 'auctionlist', []);

		$scope.auctionsDiscoveryPromise.then(function() {
			console.log("AuctionsDiscoverController auctionsDiscoveryPromise resolved");
			$timeout(function() {
				$scope.$broadcast("AUCTIONS_DISCOVERED_EVENT");	
			}, 500);
			
		}, function() {
			console.error("AuctionsDiscoverController auctionsDiscoveryPromise rejected");
		});
	}
]);

controllersModule.controller('AuctionController', ['$rootScope' ,'$scope', 'angularFire', '$timeout', '$filter', 
	function($rootScope, $scope, angularFire, $timeout, $filter) {
		$scope.$on("AUCTIONS_DISCOVERED_EVENT", function() {
			$scope.init();
		});

		$scope.isUserLoggedIn = function() {
			return $rootScope.authUser && $rootScope.authUser.isLoggedIn;
		}

		$scope.init = function() {
			angularFire(travelBidsFirebaseRef + "/auction/" + $scope.auctionId, $scope, 'auction', {})
			.then(function() {
				if ($scope.auction) {
					$scope.auctionRef = travelBidsFirebaseRef.child('auction/' + $scope.auction.id);
					$scope.biddingHistoryRef = travelBidsFirebaseRef.child('bidding-history/auction/' + $scope.auction.id);
					$scope.biddingHistory = FixedQueue(10);

					var biddingHistoryQuery = $scope.biddingHistoryRef.limit(10);
					biddingHistoryQuery.on("child_added", function(bidderSnapshot) {
						$scope.biddingHistory.unshift(bidderSnapshot.val());	
					});

					$timeout($scope.startCountdown, 200);
				}
			});
		}

		$scope.calculateTimeLeft = function() {
			if ($scope.auction) {
				var timeLeftMillis = new Date($scope.auction.endDate).getTime() - new Date().getTime();
				if ($scope.auction.status === 'STARTED') {
					if (timeLeftMillis <= $scope.auction.COUNT_DOWN_TIME * 1000) {
						$scope.auction.status = 'COUNTDOWN';

						return $scope.calculateTimeLeft();
					}

					return $filter('timeleft')(new Date(timeLeftMillis));
				} else if ($scope.auction.status === 'COUNTDOWN') {
					var secondsLeft = Math.round((timeLeftMillis - COUNT_DOWN_INTERVAL)/1000);
					$scope.displayCount(secondsLeft);

					return $scope.secondsLeft;
				}

				return Math.round(timeLeftMillis - COUNT_DOWN_INTERVAL/1000);
			}
		}

		$scope.displayCount = function(secondsLeft) {
			if (secondsLeft <= 0) {
				switch(secondsLeft) {
					case 0:
						$scope.displayCountClass = "count-once";
						break;
					case -1:
						$scope.displayCountClass = "count-twice";
						break;
					case -2:
						$scope.displayCountClass = "count-final";
						break;
					case -3:
						$scope.displayCountClass = "count-verify";
						break;
				}
			}
		}

		$scope.startCountdown = function() {
			$scope.timeLeftElement = document.getElementById("time_left" + $scope.auctionId);
			
			if ($scope.timeLeftElement) {
				$scope.timeLeftElement.innerHTML = $scope.calculateTimeLeft();

				setInterval(function() {
					//var start = new Date().getTime();
					$scope.timeLeftElement.innerHTML = $scope.calculateTimeLeft();
					//console.log("Time to calculate: " + (new Date().getTime() - start));
				}, COUNT_DOWN_INTERVAL);
			}
		}

		$scope.bid = function() {
			if (!$scope.auction) {
				console.error("Auction not initilized!");
				return;
			}

			if ($rootScope.authUser) {
				$scope.auctionRef.transaction(function(auction) {
					var auctionEndDate = $scope.getNewEndDate();

					if (auctionEndDate) {
						auction.endDate = auctionEndDate;
					}

					auction.price += 0.01;

					return auction;
				}, function(error, committed, snapshot) {
					if (error) {
						console.error("Error increasing auction price: " + error);
					}

					if (committed) {
						$scope.biddingHistoryRef.push({'username': $rootScope.authUser.name, 'userId': $rootScope.authUser.id, 'date': Firebase.ServerValue.TIMESTAMP});
						$rootScope.authUser.balance -= 1.0;
					}
				});
				
			}

		}

		$scope.getNewEndDate = function() {
			var nowMillis = new Date().getTime();
			var millis = nowMillis + $scope.auction.COUNT_DOWN_TIME * 1000;
			if(millis > new Date($scope.auction.endDate).getTime()) {
				return new Date(millis + 100).toUTCString();
			}

			return null;
		}
	}
]);

controllersModule.controller('LoginController', ['$rootScope' ,'$scope', 'angularFire', 'angularFireAuth','$timeout', '$filter', 
	function($rootScope, $scope, angularFire, angularFireAuth, $timeout, $filter) {
		$scope.auth = new FirebaseSimpleLogin(travelBidsFirebaseRef, function(error, user) {
			if (error) {
				console.error("Error logging in: " + error);
			} else if(user) {
			    console.log(user.first_name + " " + user.last_name);

			    var userChildLocation = user.provider + "-" + user.id;
				$scope.userPromise = angularFire(travelBidsFirebaseRef + "/user/" + userChildLocation, $rootScope, 'authUser', {});

				$scope.userPromise.then(function() {
					if (!$rootScope.authUser || !$rootScope.authUser.id) {
				    	$scope.registerUser(
				    		{
								id: userChildLocation,
								name: user.name,
								email: user.emails[0],
								gender: user.gender,
								created: Firebase.ServerValue.TIMESTAMP,
								provider: user.provider,
								balance: 10.00,
								isLoggedIn: true
							}, function() {
								console.log("User " + $rootScope.authUser.name + " has been registered successfully!");
								$rootScope.$broadcast('USER_LOGGS_IN');
							}
						);
					} else {
						$rootScope.authUser.isLoggedIn = true;
						$rootScope.$broadcast('USER_LOGGS_IN');
					}					
				});
		  	}
		});

		$scope.login = function(serviceProvider) {
			$scope.auth.login(serviceProvider);
		}

		$scope.logout = function() {
			console.log("Logging out user " + $scope.authUser.name);
			$scope.auth.logout();
			$rootScope.authUser.isLoggedIn = false;
			$rootScope.$broadcast("USER_LOGGS_OUT");
		}

		$scope.registerUser = function(user, callback) {
			if (user) {
				travelBidsFirebaseRef.child("user/" + user.id).set(user, callback);
			}
		}
	}
]);