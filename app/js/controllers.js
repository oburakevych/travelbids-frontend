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
				$scope.$broadcast("AUCTION_INIT");
			}, 500);
			
		}, function() {
			console.error("AuctionsDiscoverController auctionsDiscoveryPromise rejected");
		});
	}
]);

controllersModule.controller('AuctionController', ['$rootScope' ,'$scope', 'angularFire', '$timeout', '$filter', 
	function($rootScope, $scope, angularFire, $timeout, $filter) {
		$scope.$on("AUCTION_INIT", function() {
			$scope.init();
		});

		$scope.$on("AUCTION_FINISHED", function(event, auctionId) {
			console.warn("AUCTION_FINISHED");
			if ($scope.auction.id === auctionId) {
				console.log("Auction " + auctionId + " FINISHED!");
				console.log(angular.toJson($scope.auction));
				
				$timeout(function() {
					$scope.resetSeconds = 20;
					
					var winnerPromise = angularFire(travelBidsFirebaseRef + "/user/" + $scope.auction.winnerUserId, $scope, 'winner', {});
					winnerPromise.then(function(disassociate) {
						$scope.winnerDisassociateFn = disassociate;
					});

					if ($scope.auctionIntervalTimerId) {
						clearInterval($scope.auctionIntervalTimerId);
					}
				}, 0, true);
			}
		});

		$scope.$on('AUCTION_RESET', function(event, auctionId) {
			console.warn('AUCTION_RESET');

			if ($scope.auction && $scope.auction.id === auctionId) {
				$scope.auctionFinished = false;

				$scope.auctionRef.off();

				$scope.unregisterAuctionStatusWatch();
				$scope.auctionDisassociateFn();
				$scope.auction = null;
				
				$scope.winnerDisassociateFn();
				$scope.winner = null;
				
				$scope.biddingHistoryRef.remove(function() {
					$scope.biddingHistoryRef.off();
					$scope.biddingHistoryQuery.off();
				});
				
				$timeout($scope.init, 1000, true);
			}
		});

		$scope.init = function() {
			console.log("AUCTION_INIT");

			angularFire(travelBidsFirebaseRef + "/auction/" + $scope.auctionId, $scope, 'auction', {})
			.then(function(disassociate) {
				if ($scope.auction) {
					$scope.auctionDisassociateFn = disassociate;
					$scope.auctionRef = travelBidsFirebaseRef.child('auction/' + $scope.auction.id);

					$scope.authUserRef = travelBidsFirebaseRef.child('user/' + $rootScope.authUser.id);
					
					$scope.biddingHistoryRef = travelBidsFirebaseRef.child('bidding-history/auction/' + $scope.auction.id);
					$scope.biddingHistory = FixedQueue(10);
					$scope.pendingBiddingHistoryEntry = {};
					$scope.biddingHistoryQuery = $scope.biddingHistoryRef.limit(10);
					$scope.biddingHistoryQuery.on("child_added", function(bidderSnapshot) {
						$scope.biddingHistory.unshift(bidderSnapshot.val());	
					});

					$scope.unregisterAuctionStatusWatch = $scope.$watch(function() {
						return $scope.auction.status;
					}, function(newStatus, oldStatus) {
						console.log("oldStatus: " + oldStatus + "; newStatus: " + newStatus);
						if (newStatus === 'FINISHED') {
							$scope.auctionFinished = true;
							$scope.$broadcast("AUCTION_FINISHED", $scope.auction.id);
						} else if (oldStatus === 'FINISHED' && newStatus === 'COUNTDOWN') {
							$scope.$broadcast("AUCTION_RESET", $scope.auction.id);	
						} else if(newStatus != "FINISHED") {
							$timeout($scope.startCountdown, 200);
						}
					}, true);
				}
			});
		}
		
		$scope.calculateTimeLeft = function() {
			if ($scope.auction) {
				var timeLeftMillis = $scope.auction.endDate - Date.now();

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
				//var start = Date.now();
				if ($scope.auction.status === 'FINISHED') {

					$scope.$apply();

					return;
				}

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
				//console.log("Time to calculate: " + (Date.now() - start));
			}, COUNT_DOWN_INTERVAL);
		}

		$scope.bid = function() {
			if (!$scope.auction) {
				console.error("Auction not initialized!");
			}

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

					auction.price = Math.round((auction.price + 0.01) * 100)/100;

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
			var nowMillis = Date.now();
			var millis = nowMillis + $scope.auction.COUNT_DOWN_TIME;

			if(millis < $scope.auction.endDate) {
				return $scope.auction.endDate;
			}

			return millis + 100;
		}

		/*
		$scope.getTimeDiff = function() {
			console.log("getTimeDiff");
			$scope.authUserRef.transaction(function(user) {
				user.SERVER_TIME = Firebase.ServerValue.TIMESTAMP;
				return user;
			}, function(error, committed, snapshot) {
				if (error) {
					console.wrror("Error getting the SERVER_TIME");
				}

				if (committed) {
					var serv = snapshot.val();
					var serverDate = new Date(snapshot.val().SERVER_TIME * 1000);
					var localDate = new Date();

					console.log("Server date: " + serverDate);
					console.log("Local  date: " + localDate);
				}
			});
		}
		*/

		$scope.finishAuction = function() {
			$scope.auctionFinished = true;

			$scope.auctionRef.transaction(function(auction) {
				auction.status = "FINISHED";

				if ($scope.biddingHistory.length > 0) {
					auction.winnerUserId = $scope.biddingHistory[0].userId;
				} else {
					console.warn("Auction finished with no winner");
					auction.winnerUserId = "nowinner";
				}

				return auction;
			}, function(error, committed, snapshot) {
				if (error) {
					console.error("Error finishing the auction!");
					auction.status = "ERROR";
				}
			});
		}

		$scope.resetTimer = function() {
			$scope.auctionRef.transaction(function(auction) {
					console.log("About to Set COUNTDOWN in transaction");
					auction.status = "COUNTDOWN";
					console.log("Set COUNTDOWN in transaction");
					auction.endDate = Date.now() + $scope.resetSeconds * 1000 + 1250;
					auction.winnerUserId = null;
					auction.price = 0.01;

					return auction;
			});
		}

		$scope.isUserLoggedIn = function() {
			return $rootScope.authUser && $rootScope.authUser.isLoggedIn;
		}

		$scope.isAdminLoggedIn = function() {
			return $scope.isUserLoggedIn();// && $rootScope.authUser.id == 'facebook-1334464456';
		}

		$scope.isZeroOrNegativeBallance = function() {
			return $scope.isUserLoggedIn() && $rootScope.authUser.balance <= 0;
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

				$scope.userPromise.then(function(disassociate) {
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

					$scope.logout = function() {
						console.log("Logging out user " + $rootScope.authUser.name);
						$scope.auth.logout();
						$rootScope.authUser.isLoggedIn = false;

						$rootScope.$broadcast("USER_LOGGS_OUT", $rootScope.authUser.id);

						disassociate();
						$rootScope.authUser = null;
					}
				});
		  	}
		});

		$scope.login = function(serviceProvider) {
			$scope.auth.login(serviceProvider);
		}

		$scope.registerUser = function(user, callback) {
			if (user) {
				travelBidsFirebaseRef.child("user/" + user.id).set(user, callback);
			}
		}
	}
]);