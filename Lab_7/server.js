/***********************
  Load Components!

  Express      - A Node.js Framework
  Body-Parser  - A tool to help use parse the data in a post request
  Pg-Promise   - A database tool to help use connect to our PostgreSQL database
***********************/
var express = require('express'); //Ensure our express framework has been added
var app = express();
var bodyParser = require('body-parser'); //Ensure our body-parser tool has been added
app.use(bodyParser.json());              // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

//Create Database Connection
var pgp = require('pg-promise')();

/**********************
  Database Connection information
  host: This defines the ip address of the server hosting our database.
		We'll be using `db` as this is the name of the postgres container in our
		docker-compose.yml file. Docker will translate this into the actual ip of the
		container for us (i.e. can't be access via the Internet).
  port: This defines what port we can expect to communicate to our database.  We'll use 5432 to talk with PostgreSQL
  database: This is the name of our specific database.  From our previous lab,
		we created the football_db database, which holds our football data tables
  user: This should be left as postgres, the default user account created when PostgreSQL was installed
  password: This the password for accessing the database. We set this in the
		docker-compose.yml for now, usually that'd be in a seperate file so you're not pushing your credentials to GitHub :).
**********************/
const dbConfig = {
	host: 'db',
	port: 5432,
	database: 'football_db',
	user: 'postgres',
	password: 'pwd'
};

var db = pgp(dbConfig);

// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/'));//This line is necessary for us to use relative paths and access our resources directory



/*********************************
 Below we'll add the get & post requests which will handle:
   - Database access
   - Parse parameters from get (URL) and post (data package)
   - Render Views - This will decide where the user will go after the get/post request has been processed

 Web Page Requests:

  Login Page:        Provided For your (can ignore this page)
  Registration Page: Provided For your (can ignore this page)
  Home Page:
  		/home - get request (no parameters)
  				This route will make a single query to the favorite_colors table to retrieve all of the rows of colors
  				This data will be passed to the home view (pages/home)

  		/home/pick_color - post request (color_message)
  				This route will be used for reading in a post request from the user which provides the color message for the default color.
  				We'll be "hard-coding" this to only work with the Default Color Button, which will pass in a color of #FFFFFF (white).
  				The parameter, color_message, will tell us what message to display for our default color selection.
  				This route will then render the home page's view (pages/home)

  		/home/pick_color - get request (color)
  				This route will read in a get request which provides the color (in hex) that the user has selected from the home page.
  				Next, it will need to handle multiple postgres queries which will:
  					1. Retrieve all of the color options from the favorite_colors table (same as /home)
  					2. Retrieve the specific color message for the chosen color
  				The results for these combined queries will then be passed to the home view (pages/home)

  		/team_stats - get request (no parameters)
  			This route will require no parameters.  It will require 3 postgres queries which will:
  				1. Retrieve all of the football games in the Fall 2018 Season
  				2. Count the number of winning games in the Fall 2018 Season
  				3. Count the number of lossing games in the Fall 2018 Season
  			The three query results will then be passed onto the team_stats view (pages/team_stats).
  			The team_stats view will display all fo the football games for the season, show who won each game,
  			and show the total number of wins/losses for the season.

  		/player_info - get request (no parameters)
  			This route will handle a single query to the football_players table which will retrieve the id & name for all of the football players.
  			Next it will pass this result to the player_info view (pages/player_info), which will use the ids & names to populate the select tag for a form
************************************/

// login page
app.get('/', function(req, res) {
	res.render('pages/login',{
		local_css:"signin.css",
		my_title:"Login Page"
	});
});

// registration page
app.get('/register', function(req, res) {
	res.render('pages/register',{
		my_title:"Registration Page"
	});
});

app.get('/home', function(req, res) {
	var query = 'select * from favorite_colors;';
	db.any(query)
        .then(function (rows) {
            res.render('pages/home',{
				my_title: "Home Page",
				data: rows,
				color: '',
				color_msg: ''
			})

        })
        .catch(function (err) {
            console.log('error', err);
            res.render('pages/home', {
                my_title: 'Home Page',
                data: '',
                color: '',
                color_msg: ''
            })
        })
});

app.get('/home/pick_color', function(req, res) {
	var color_choice = req.query.color_selection; // Investigate why the parameter is named "color_selection"
	var color_options = "SELECT * FROM favorite_colors;";
	var color_message = "SELECT color_msg FROM favorite_colors WHERE hex_value = '" + color_choice + "';";
	db.task('get-everything', task => {
        return task.batch([
            task.any(color_options),
            task.any(color_message)
        ]);
    })
    .then(info => {
    	res.render('pages/home',{
				my_title: "Home Page",
				data: info[0],
				color: color_choice,
				color_msg: info[1][0].color_msg
			})
    })
    .catch(err => {
            console.log('error', err);
            res.render('pages/home', {
                my_title: 'Home Page',
                data: '',
                color: '',
                color_msg: ''
            })
    });

});

app.post('/home/pick_color', function(req, res) {
	var color_hex = req.body.color_hex;
	var color_name = req.body.color_name;
	var color_message = req.body.color_message;
	var insert_statement = "INSERT INTO favorite_colors(color_hex, color_name, color_message) VALUES ('" +color_hex + "','" +color_name + "','" + color_message +"');";
	var color_select = "SELECT * FROM favorite_colors;";
	console.log(insert_statement);
	console.log(color_hex, color_name, color_message);



	db.task('get-everything', task => {
        return task.batch([
            task.any(insert_statement),
            task.any(color_select)
        ]);
    })
    .then(info => {
    	res.render('pages/home',{
				my_title: "Home Page",
				data: info[1], // Return the color choices
				color: color_name,// Return the hex value of the color added to the table
				color_msg: color_message// Return the color message of the color added to the table
			})
    })
    .catch(err => {
            console.log('error', err);
            res.render('pages/home', {
                my_title: 'Home Page',
                data: '',
                color: '',
                color_msg: ''
            })
    });
});

// Football Games Page
app.get('/team_stats', function(err, res){
	var list_game = "SELECT * FROM football_games;";
	var losing_count = "SELECT COUNT(*) FROM football_games WHERE visitor_score > home_score;";
	var winning_count = "SELECT COUNT(*) FROM football_games WHERE visitor_score < home_score;";

	db.task('get-everything', task => {
		return task.batch([
			task.any(list_game),
			task.any(losing_count),
			task.any(winning_count)
		]);
	})
	.then(data => {
		res.render('pages/team_stats',{
				my_title: "Football Games",
				games: data[0],
				win_total: data[1][0].count,
				loss_total: data[2][0].count
			})
	})
	.catch(err => {
		// display error message in case an error
			console.log('error', err);
			err.render('pages/team_stats',{
				my_title: "Football Games",
				data: '',
				win_total: 'Error',
				loss_total: 'Error'
			})
	});
});

//Football Player Page
app.get('/player_info', function(req, res) {
	var players = 'SELECT id, name FROM football_players;'
	
	db.task('get-everything', task => {
        return task.batch([
            task.any(players)
        ]);
    })
	.then(data => {
    	console.log(data[1])
    	res.render('pages/player_info',{
				my_title: "Football Games",
				players: data[0],
				player_info: '',
				games_played: ''
			})
    })
    .catch(function (err) {
        request.flash('error', err);
        response.render('pages/player_info', {
                title: 'Football Player Information',
                players: '',
                player_info: '',
                games_played: ''
            })
        })

});

app.get('/player_info/player', function(req, res) {
	var player_id = req.query.player_choice;
	var players = 'SELECT id, name FROM football_players;';
	var player_info = 'SELECT * FROM football_players WHERE id=' + player_id + ';';
	var games_played = 'SELECT count(*) FROM football_games WHERE ' + player_id + '=any(players);';

	 db.task('get-everything', task => {
        return task.batch([
            task.any(players),
            task.any(player_info),
            task.any(games_played)
        ]);
    })
    .then(data => {
    	console.log(data[1])
    	res.render('pages/player_info',{
				my_title: "Football Games",
				players: data[0],
				player_info: data[1][0],
				games_played: data[2][0].count
			})
    })
    .catch(error => {
            request.flash('error', err);
            response.render('pages/player_info', {
                title: 'Football Player Information',
                players: '',
                player_info: '',
                games_played: ''
            })
    });

});

app.post('/player_info/add_player', function(req, res) {
	var player_id = req.query.player_choice;
	var playerName = req.body.playerName;
	var playerYear = req.body.playerYear;
	var playerMajor = req.body.playerMajor;
	var playerPassingYards = req.body.playerPassingYards;
	var playerRushingYards = req.body.playerRushingYards;
	var playerReceivingYards = req.body.playerReceivingYards;
	var players = 'SELECT id, name FROM football_players;';
	var player_info = 'SELECT * FROM football_players WHERE id=' + player_id + ';';
	var insert_statement = "INSERT INTO football_players(playerName, playerYear, playerMajor, playerPassingYards, playerRushingYards, playerReceivingYards) VALUES ('" + playerName + "','" + playerYear + "','" + playerMajor + "','" + playerPassingYards + "','" + playerRushingYards + "','" + playerReceivingYards + "');";

	db.task('get-everything', task => {
        return task.batch([
            task.any(insert_statement),
			task.any(players),
        ]);
    })
    .then(info => {
    	res.render('pages/player_info',{
			my_title: "Football Player Information",
			players: data[1],
			player_info: '',
			games_played: ''
		})
    })
    .catch(err => {
        console.log('error', err);
        res.render('pages/player_info', {
			my_title: "Football Player Information",
			players: '',
			player_info: '',
			games_played: ''
        })
    });
});

app.listen(3000);
console.log('3000 is the magic port');
