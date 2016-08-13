var request = require("request");
var cheerio = require("cheerio");
var Q = require("q");

/* --------------  ADDITIONS FROM DI ----------------- */

//return an array of only the sentences with stats in them
function getListOfSentences(text){
	var unformattedList = text.split(".")
	var formattedList = [];
	for(var i = 0; i < unformattedList.length; i++){
		var isMatch = unformattedList[i].match(/\d+|\%|\$/);	
		if(isMatch != null){
			formattedList.push(unformattedList[i]);
		};	
	};
	return formattedList;
};

//get only the text from the article and pass it to the formatter
function getTextFromArticle(url){
	var deferred = Q.defer();
    request(url, function(err, res) {
    	var $ = cheerio.load(res.body);
		var baseUrl = url.replace(/^((\w+:)?\/\/[^\/]+\/?).*$/,'$1');
		var dateTarget;
		switch(baseUrl) {
		    case 'http://finance.yahoo.com/':
		        dateTarget = '.date';
		        break;
		    case 'https://www.thestreet.com/':
		        dateTarget = '.article__publish-date.article__byline-item time';
		        break;
		    case 'http://www.wsj.com/':
		        dateTarget = 'time.timestamp';
		        break;
		};

		// Remove periods, upper case all letters, convert ET to EDT for date format to work
		var articleDate = new Date($(dateTarget).text().toUpperCase().replace(/\./g,'').replace('ET', "EDT"));
		console.log(articleDate);
    	// var unformattedText = $(".canvas-body").text()
    	// var formattedList = getListOfSentences(unformattedText);
		// deferred.resolve(formattedList);
    });
    return deferred.promise;	
};

//get an array of links from any news source
function getListOfArticleLinks(url){
	var deferred = Q.defer();
    request(url, function(err, res) {
    	var $ = cheerio.load(res.body);
		var listOfLinks = [];
		var link = "";
		var classTarget;
		var baseUrl = url.replace(/^((\w+:)?\/\/[^\/]+\/?).*$/,'$1');
		switch(baseUrl) {
		    case 'http://finance.yahoo.com/':
		        classTarget = '.nothumb .txt a';
		        break;
		    case 'https://www.thestreet.com/':
		        classTarget = '.news-ticker__headline .row .col-sm-9 a';
		        break;
		    case 'http://www.finviz.com/':
		        classTarget = '.tab-link-news';
		        break;
		};
    	$(classTarget).each(function (index, element) {
    		if ($(element).attr('href').includes('.com')) {
	    		listOfLinks.push($(element).attr('href'));
    		} else {
	    		listOfLinks.push(baseUrl.substring(0, baseUrl.length - 1) + $(element).attr('href'));
    		}
		});
		deferred.resolve(listOfLinks);
    });
    return deferred.promise;
}

//get an array of all sentences from each article
function getListOfArticleSentences(listOfArticleLinks){
	var listOfArticleSentences = [];
	for(var i = 0; i < listOfArticleLinks.length; i++){
		var listOfSentences = getTextFromArticle(listOfArticleLinks[i]);
		listOfArticleSentences.push(listOfSentences);
	};
	return Q.all(listOfArticleSentences);
};

//output all sentences with stats for each article on yahoo AP

// var sourceUrl = "http://finance.yahoo.com/news/provider-ap/?bypass=true";
var sourceUrl = "https://www.thestreet.com/latest-news";
// var sourceUrl = "http://www.finviz.com/quote.ashx?t=" + "KSS";
// getListOfArticleLinks(sourceUrl).then(function(listOfArticleLinks){

// 	var topFiveRecent = listOfArticleLinks.slice(0, 5);
// 	console.log(topFiveRecent);
// 	getListOfArticleSentences(topFiveRecent).then(function(listOfArticleSentences){
// 		//console.log(listOfArticleSentences);
// 		for(var i = 0; i < listOfArticleSentences.length; i++){
// 			console.log("______________ Article " + (i + 1) + "________________");
// 			var currentArticle = listOfArticleSentences[i];
// 			console.log(currentArticle.join("\n\n"));
// 			console.log("______________________END OF ARTICLE_______________________________");
// 			console.log("\n");
// 		};
// 	});
// });

//get an array of sentences with stats for an article at specified URL
var articleUrl = "http://finance.yahoo.com/news/nbcs-prime-time-olympics-due-change-221824505--spt.html";
// var articleUrl = "https://www.thestreet.com/story/13674322/1/amazon-remains-intent-on-staying-ahead-of-hungry-cloud-rivals.html";
// var articleUrl = "http://www.wsj.com/articles/where-we-spending-is-unending-traditional-retail-1471041884?ru=yahoo?mod=yahoo_itp";
getTextFromArticle(articleUrl).then(function(list){
	console.log(list);
});

/* --------------  END OF ADDITIONS ----------------- */


var getTrendingTickers = function(url) {
	var deferred = Q.defer();
    request(url, function(err, res) {
		var trendingTickers = [];
    	var $ = cheerio.load(res.body);
		$('.with-ticker-card').filter(function(){
			var trendingTicker = $(this).html();
			trendingTickers.push(trendingTicker);
		});
		deferred.resolve(trendingTickers);
    });
    return deferred.promise;
};

var financeRequest = function(url){
	var deferred = Q.defer();
	request(url, function (error, response, body) {
	  if (!error && response.statusCode == 200) {
		deferred.resolve(body);
	  }
	})
	return deferred.promise;
};

var googleYahooRequests = function(tickersArray) {
	var packGoogleYahooRequests = [];
	var googleFinanceUrl = 'http://finance.google.com/finance/info?client=ig&q=' + tickersArray.join();
	var yahooFinanceUrl = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%27' + tickersArray.join() + '%27)%0A%09%09&format=json&env=http%3A%2F%2Fdatatables.org%2Falltables.env&callback=';
	packGoogleYahooRequests.push(financeRequest(googleFinanceUrl), financeRequest(yahooFinanceUrl));
	return Q.all(packGoogleYahooRequests);
}

var formatStocks = function(googleArray, yahooArray) {
    var googleFinance = JSON.parse(googleArray.substring(3, googleArray.length));
    var yahooFinance = JSON.parse(yahooArray).query.results.quote;
    var stocks = [];
    // console.log(googleFinance.length, yahooFinance.length);
    for(var i = 0; i < yahooFinance.length; i++){
    	var yahooSymbol = yahooFinance[i].Symbol;
    	for(var j = 0; j < googleFinance.length; j++){
    		var googleSymbol = googleFinance[j].t;
    		if(yahooSymbol == googleSymbol){
				var stock = {};
				// Google Finance
				if (googleSymbol) {
					stock.symbol = googleSymbol || Math.random();
				}
				if (googleFinance[j].l) {
					stock.current = parseFloat(googleFinance[j].l);
				}
				if (googleFinance[j].cp) {
					stock.changePrice = parseFloat(googleFinance[j].c);
				}
				if (googleFinance[j].cp) {
					stock.changePercent = parseFloat(googleFinance[j].cp);
				} else {
					stock.changePercent = 0;
				}
				if (googleFinance[j].lt) {
					stock.lastUpdated = googleFinance[j].lt;
				}
				if (googleFinance[j].div) {
					stock.div = parseFloat(googleFinance[j].div);
				}
				// Yahoo Finance
				if (yahooFinance[i].Name) {
					stock.name = yahooFinance[i].Name;
				}
				if (yahooFinance[i].AverageDailyVolume) {
					stock.averageDailyVolume = parseFloat(yahooFinance[i].AverageDailyVolume);						
				}
				if (yahooFinance[i].Open) {
					stock.open = parseFloat(yahooFinance[i].Open);						
				}
				if (yahooFinance[i].PreviousClose) {
					stock.close = parseFloat(yahooFinance[i].PreviousClose);						
				}
				if (yahooFinance[i].DaysRange) {
					stock.dayRange = yahooFinance[i].DaysRange;						
				}
				if (yahooFinance[i].YearRange) {
					stock.yearRange = yahooFinance[i].YearRange;						
				}
				if (yahooFinance[i].FiftydayMovingAverage) {
					stock.fiftyDayMovingAverage = parseFloat(yahooFinance[i].FiftydayMovingAverage);
				}
				if (yahooFinance[i].TwoHundreddayMovingAverage) {
					stock.twoHundredDayMovingAverage = parseFloat(yahooFinance[i].TwoHundreddayMovingAverage);
				}
				if (yahooFinance[i].DividendYield) {
					stock.dividendYield = parseFloat(yahooFinance[i].DividendYield);
				} else {
					stock.dividendYield = 'N/A';
				}
				if (yahooFinance[i].DividendPayDate) {
					stock.dividendPayDate = yahooFinance[i].DividendPayDate;
				} else {
					stock.dividendPayDate = 'N/A';
				}
				stocks.push(stock);
    		}
    	}
    }
	return stocks;
}

// var stockTwitsUrl = "http://stocktwits.com/";
// getTrendingTickers(stockTwitsUrl).then(function(tickersArray) {
// 	googleYahooRequests(tickersArray).then(function(googleYahooArray) {

// 		var formattedStocks = formatStocks(googleYahooArray[0], googleYahooArray[1]);

// 		formattedStocks.sort(function(a, b) {
// 		    return parseFloat(a.changePercent) - parseFloat(b.changePercent);
// 		}).reverse();

// 		console.log(formattedStocks);
// 		console.log(formattedStocks.length);
// 	});
// });