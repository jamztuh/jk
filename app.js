var request = require("request");
var cheerio = require("cheerio");
var Q = require("q");

/* --------------  ADDITIONS FROM DI ----------------- */

//return an array of only the sentences with stats in them
var getStatSentences = function(text){
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
var getArticle = function(url){
	var deferred = Q.defer();
    request(url, function(err, res) {
    	var $ = cheerio.load(res.body);
		var baseUrl = url.replace(/^((\w+:)?\/\/[^\/]+\/?).*$/,'$1');
		var dateTarget;
		var titleTarget;
		var contentTarget;
		switch(baseUrl) {
		    case 'http://finance.yahoo.com/':
		        dateTarget = '.date';
		        titleTarget = '.canvas-header';
		        contentTarget = '.canvas-body';
		        break;
		    case 'http://247wallst.com/':
		        dateTarget = '.timestamp';
		        titleTarget = '.entry-title';
		        contentTarget = '.entry-content';
		        break;
		    case 'https://www.thestreet.com/':
		        dateTarget = '.article__publish-date.article__byline-item time';
		        titleTarget = '.article__headline';
		        contentTarget = '.article__body';
		        break;
		    case 'http://www.wsj.com/':
		        dateTarget = 'time.timestamp';
		        titleTarget = '.wsj-article-headline';
		        contentTarget = '.wsj-snippet-body';
		        break;
		    case 'http://www.businesswire.com/':
		        dateTarget = '.bw-release-timestamp time';
		        titleTarget = 'h1.epi-fontLg';
		        contentTarget = '.bw-release-story';
		        break;
		    case 'http://www.marketwatch.com/':
		        dateTarget = '#published-timestamp span';
		        titleTarget = '#article-headline';
		        contentTarget = '#article-body';
		        break;
		    case 'http://realmoney.thestreet.com/':
		        dateTarget = '.details .date';
		        titleTarget = '.headline h2';
		        contentTarget = '.article .content';
		        break;
		    case 'http://www.fool.com/':
		        dateTarget = '.publication-date';
		        titleTarget = '.usmf-new.article-header header h1';
		        contentTarget = '.usmf-new.article-body .article-content';
		        break;
		};

		// Upper case, remove .'s, remove &nbps;'s, remove |'s, convert to EDT, and trim trailing white space for date format to work
		var articleDate = $(dateTarget).text().toUpperCase().replace(/\./g,'').replace(/\u00a0/g, " ").replace(/\|/g,'').replace('ET', 'EDT').replace('EASTERN DAYLIGHT TIME', 'EDT').trim();
		// console.log('Date: ', articleDate);
		var articleTitle = $(titleTarget).text();
		// console.log('Title: ', articleTitle);
		var articleContent = $(contentTarget).text();
		// console.log('Content: ', articleContent);
    	var statSentences = getStatSentences(articleContent);
    	// console.log(statSentences);
		var article = {
			url: url,
			title: articleTitle,
			date: articleDate,
			content: articleContent,
			statSentences: getStatSentences(articleContent)
		};
		deferred.resolve(article);
    });
    return deferred.promise;	
};

//get an array of links from any news source
var getArticleLinks = function(url){
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
		    case 'http://247wallst.com/':
		        classTarget = '.hentry .entry-title a'
		        break;
		    case 'https://www.thestreet.com/':
		        classTarget = '.news-ticker__headline .row .col-sm-9 a';
		        break;
		    case 'http://stream.wsj.com/':
		        classTarget = '.sSubType-article a.stri-viewSec'
		        break;
		    case 'http://www.finviz.com/':
		        classTarget = '.tab-link-news';
		        break;
		    case 'http://www.businesswire.com/':
		        classTarget = 'a.bwTitleLink';
		        break;
		    case 'http://www.marketwatch.com/':
		        classTarget = '.nv-text-cont h4 a.read-more';
		        break;
		    case 'http://www.fool.com/':
		        classTarget = '#recent-article-hl';
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
var getListOfArticleSentences = function(listOfArticleLinks){
	var listOfArticleSentences = [];
	for(var i = 0; i < listOfArticleLinks.length; i++){
		var listOfSentences = getArticle(listOfArticleLinks[i]);
		listOfArticleSentences.push(listOfSentences);
	};
	return Q.all(listOfArticleSentences);
};

//output all sentences with stats for each article on yahoo AP
var printArticles = function(sourceUrl) {
	getArticleLinks(sourceUrl).then(function(listOfArticleLinks){
		var topThreeRecent = listOfArticleLinks.splice(0, 3);
		// console.log(topThreeRecent);
		getListOfArticleSentences(topThreeRecent).then(function(listOfArticle){
			for(var i = 0; i < listOfArticle.length; i++){
				console.log('Url: ', listOfArticle[i].url);
				console.log('Title: ', listOfArticle[i].title);
				console.log('Date: ', listOfArticle[i].date);
				// console.log('Content: ', listOfArticle[i].content);
				console.log('Stat Sentences: ', listOfArticle[i].statSentences);
			};
		});
	});
};

// var sourceUrl = "http://finance.yahoo.com/news/provider-ap/?bypass=true";
// var sourceUrl = "http://247wallst.com/";
// var sourceUrl = "https://www.thestreet.com/latest-news";
// var sourceUrl = "http://stream.wsj.com/story/latest-headlines/SS-2-63399/";
// var sourceUrl = "http://www.finviz.com/quote.ashx?t=" + "KSS";
// var sourceUrl = "http://www.businesswire.com/portal/site/home/news/";
// var sourceUrl = "http://www.marketwatch.com/newsviewer";
var sourceUrl = "http://www.fool.com/investing-news/";
// printArticles(sourceUrl);

//get an array of sentences with stats for an article at specified URL
// var articleUrl = "http://finance.yahoo.com/news/nbcs-prime-time-olympics-due-change-221824505--spt.html";
// var articleUrl = "https://www.thestreet.com/story/13674322/1/amazon-remains-intent-on-staying-ahead-of-hungry-cloud-rivals.html";
// var articleUrl = "http://www.wsj.com/articles/where-we-spending-is-unending-traditional-retail-1471041884?ru=yahoo?mod=yahoo_itp";
// var articleUrl = "http://247wallst.com/services/2016/08/12/what-analysts-are-saying-after-alibaba-reported-earnings/"
// var articleUrl = "http://www.marketwatch.com/story/full-house-home-in-san-francisco-on-the-market-for-415-million-2016-06-01?siteid=yhoof2";
// var articleUrl = "http://realmoney.thestreet.com/articles/08/12/2016/july-retail-sales-are-good-sign-amazon";
// getArticle(articleUrl).then(function(statSentencesArray){
// 	console.log(statSentencesArray);
// });

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

var printTrendingStocks = function(stocksUrl) {
	getTrendingTickers(stocksUrl).then(function(tickersArray) {
		googleYahooRequests(tickersArray).then(function(googleYahooArray) {

			var formattedStocks = formatStocks(googleYahooArray[0], googleYahooArray[1]);

			formattedStocks.sort(function(a, b) {
			    return parseFloat(a.changePercent) - parseFloat(b.changePercent);
			}).reverse();

			console.log(formattedStocks);
			console.log(formattedStocks.length);
		});
	});
}

var stocksUrl = "http://stocktwits.com/";
printTrendingStocks(stocksUrl);

