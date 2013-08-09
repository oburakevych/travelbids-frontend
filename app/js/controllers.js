'use strict';

/* Controllers */

var controllersModule = angular.module('myApp.controllers', []);

var url = 'https://travelbids.firebaseio.com';
var travelBidsFirebaseRef = new Firebase(url);
var COUNT_DOWN_INTERVAL = 1000;
var AUCTION_FINISHED_CONDITION = 3 * 1000 * (-1);
var EMPTY = "";
  
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

		$scope.$on("AUCTION_FINISHED", function(event, auctionId) {
			if ($scope.auction.id === auctionId) {
				console.warn("Auction " + auctionId + " FINISHED!");
				$scope.resetSeconds = 60;
				//$scope.winnerPromise = angularFire(travelBidsFirebaseRef + "/user/" + $scope.auction.winnerUserId, $scope, 'winner', {});
				var winnerRef = travelBidsFirebaseRef.child('user/' + $scope.auction.winnerUserId);
				winnerRef.once('value', function(userSnapshot) {
					$timeout(function() {
						$scope.winner = userSnapshot.val();
					}, 20, true);
				});
			}
		});

		$scope.isUserLoggedIn = function() {
			return $rootScope.authUser && $rootScope.authUser.isLoggedIn;
		}

		$scope.isAdminLoggedIn = function() {
			return $scope.isUserLoggedIn() && $rootScope.authUser.id == 'facebook-1334464456';
		}

		$scope.isZeroOrNegativeBallance = function() {
			return $scope.isUserLoggedIn() && $rootScope.authUser.balance <= 0;
		}

		$scope.init = function() {
			angularFire(travelBidsFirebaseRef + "/auction/" + $scope.auctionId, $scope, 'auction', {})
			.then(function() {
				if ($scope.auction) {
					$scope.auctionRef = travelBidsFirebaseRef.child('auction/' + $scope.auction.id);
					$scope.biddingHistoryRef = travelBidsFirebaseRef.child('bidding-history/auction/' + $scope.auction.id);
					$scope.biddingHistory = FixedQueue(10);
					$scope.pendingBiddingHistoryEntry = {};

					var biddingHistoryQuery = $scope.biddingHistoryRef.limit(10);
					biddingHistoryQuery.on("child_added", function(bidderSnapshot) {
						$scope.biddingHistory.unshift(bidderSnapshot.val());	
					});

					if ($scope.auction.status != 'FINISHED') {
						$timeout($scope.startCountdown, 200);
					} else {
						$scope.auctionFinished = true;
						$rootScope.$broadcast("AUCTION_FINISHED", $scope.auction.id);
					}
				}
			});
		}
		
		$scope.calculateTimeLeft = function() {
			if ($scope.auction) {
				var timeLeftMillis = $scope.auction.endDate - new Date().getTime();

				return timeLeftMillis;
			}
		}

		$scope.displayCount = function(millisLeft) {
			if (millisLeft < COUNT_DOWN_INTERVAL) {
				var displayClass = null;
				switch(TimeUtil.millisToSeconds(millisLeft)) {
					case 0:
						displayClass = "count-once";
						break;
					case -1:
						displayClass = "count-twice";
						break;
					case -2:
						displayClass = "count-final";
						break;
					case -3:
						displayClass = "count-verify";
						break;
					default:
						displayClass = EMPTY;
				}

				return displayClass;
			}

			return EMPTY;
		}

		$scope.startCountdown = function() {
			$scope.timeLeft = $scope.calculateTimeLeft();

			$scope.auctionIntervalTimerId = setInterval(function() {
				//var start = new Date().getTime();
				$scope.timeLeft = $scope.calculateTimeLeft();
				
				if ($scope.timeLeft <= $scope.auction.COUNT_DOWN_TIME) {
					if ($scope.timeLeft < AUCTION_FINISHED_CONDITION) {
						if (TimeUtil.millisToSeconds($scope.timeLeft) <= TimeUtil.millisToSeconds(AUCTION_FINISHED_CONDITION)) {
							$scope.finishAuction();
						}
					}

					if ($scope.auction.status !== 'COUNTDOWN') {
						$scope.auction.status = 'COUNTDOWN';
					}
				}

				$scope.$apply();
				//console.log("Time to calculate: " + (new Date().getTime() - start));
			}, COUNT_DOWN_INTERVAL);
		}

		$scope.bid = function() {
			if ($scope.auction.status === 'FINISHED') {
				console.error("Auction already fishished!");
				return;
			}

			if ($rootScope.authUser) {
				if ($scope.isZeroOrNegativeBallance()) {
					console.error("No sufficient funds to bid! Account balance: " + $rootScope.authUser.balance);
					return;
				}

				$scope.auctionRef.transaction(function(auction) {
					var auctionEndDate = $scope.getNewEndDate();

					if (auctionEndDate) {
						auction.endDate = auctionEndDate;
					}

					auction.price = Math.round((auction.price + 0.01) * 1000)/1000;

					$rootScope.authUser.balance -= 1.0;
					$scope.biddingHistoryEntry = $scope.biddingHistoryRef.push({'username': $rootScope.authUser.name, 'userId': $rootScope.authUser.id, 'date': Firebase.ServerValue.TIMESTAMP});

					return auction;
				}, function(error, committed, snapshot) {
					if (error) {
						console.error("Error increasing auction price: " + error);
						$rootScope.authUser.balance += 1.0; // Roll back account balance
						$scope.biddingHistoryEntry.remove();
					}

					if (committed) {
						
					}
				});
				
			}

		}

		$scope.getNewEndDate = function() {
			var nowMillis = new Date().getTime();
			var millis = nowMillis + $scope.auction.COUNT_DOWN_TIME;

			if(millis < $scope.auction.endDate) {
				return $scope.auction.endDate;
			}

			return millis + 100;
		}

		$scope.finishAuction = function() {
			$scope.auctionFinished = true;

			$scope.auctionRef.transaction(function(auction) {
				auction.status = "FINISHED";
				if ($scope.biddingHistory.length === 0) {
					$scope.biddingHistoryRef.push({'username': 'NO WINNER', 'userId': '0', 'date': Firebase.ServerValue.TIMESTAMP});
				}

				auction.winnerUserId = $scope.biddingHistory[0].userId;

				return auction;
			}, function() {
				$rootScope.$broadcast("AUCTION_FINISHED", $scope.auction.id);
			});

			$scope.$apply();

			if ($scope.auctionIntervalTimerId) {
				clearInterval($scope.auctionIntervalTimerId);
			}
		}

		$scope.resetTimer = function() {
			$scope.auctionRef.transaction(function(auction) {
					auction.status = "COUNTDOWN";
					auction.endDate = new Date().getTime() + $scope.resetSeconds * 1000 + 300;
					auction.winnerUserId = null;
					auction.price = 0.01;

					$scope.biddingHistoryRef.remove(function() {
						$scope.biddingHistory = FixedQueue(10);
					});

					return auction;
			}, function() {
				$scope.auctionFinished = false;
				if ($scope.winner) {
					$scope.winner = null;
				}
				$timeout($scope.startCountdown, 200);
			});
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