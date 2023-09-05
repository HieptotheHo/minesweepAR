const Scene = require('Scene');
const Blocks = require("Blocks")
const TouchGestures = require('TouchGestures');
// Use export keyword to make a symbol available in scripting debug console
export const Diagnostics = require('Diagnostics');
const Materials = require('Materials');
const Time = require('Time');
const Patches = require('Patches');
const DeviceMotion = require("DeviceMotion");
const Audio = require('Audio')

var rows= 0;
var cols = 0;
var numberOfMines = 0;
var tileDistance = 0.06;

var longTouchGestureSub

var mode //1 --> 2 -->3

var flagMode = false;


var board = [];

var win = false;
var gameOver = false;
var tilesClicked = 0;

var EXPLOSION;

var second = 1;
var minute =0;


var loseByOpenByNum = false;
var autoExpandTiles;

(async function r() {  // Enables async/await in JS [part 1]

  var minesLocation = [];
  // //---------------------------------------------------------------
  //BOARD
  const TramKiemSoatMatDat = await Scene.root.findFirst("TramKiemSoatMatDat");
  const minesweeperBoard = await Scene.root.findFirst("minesweeperBoard");


  //Emitter
  const emitter = await Scene.root.findFirst("emitter")
  const emitter0 = await Scene.root.findFirst("emitter0")
  const emitter1 = await Scene.root.findFirst("emitter1")
  const emitter2 = await Scene.root.findFirst("emitter2")

  //Open sound effect
  const openTileSound = await Audio.getAudioPlaybackController('openTileSound');

  // FLAG
  const flagButton = await Scene.root.findFirst("flagButton")
  Diagnostics.log("minesweepAR")
  TouchGestures.onTap(flagButton).subscribe(clickFlagButton)
  
  // chon do khó của game: beginner, intermediate, hard
  const beginnerButton = await Scene.root.findFirst("beginner")
  TouchGestures.onTap(beginnerButton).subscribe(()=>{
    mode = 1
    setGameMode(8,8,10)
  })
  const intermediateButton = await Scene.root.findFirst("intermediate")
  TouchGestures.onTap(intermediateButton).subscribe(()=>{
    mode = 2
    setGameMode(16,16,40)
  })
  const expertButton = await Scene.root.findFirst("expert")
  TouchGestures.onTap(expertButton).subscribe(()=>{
    mode = 3
    setGameMode(16,30,99)
  })

  // rendering....
  const renderingSign = await Scene.root.findFirst("renderingSign")
  const introCanvas = await Scene.root.findFirst("intro");

  // before starting
  const start= await Patches.outputs.getPulse("start");
  const beforeStartingCanvas = await Scene.root.findFirst("beforeStarting");
  beforeStartingCanvas.hidden = true;

  //nếu bấm vào start thì set up object tap cho tiles và cho chạy timer
  start.subscribe(settupTileTap)
  function settupTileTap() {
    gameOver = false;
    timer.text = "00:00"
    duringGameCanvas.hidden=false;
    undoCanvas.hidden= true;
    for(let i = 0;i<rows;i++) {
      for (let j = 0;j<cols;j++) {
        TouchGestures.onTap(board[i][j][0]).subscribe(()=>{
          clickTile(i,j,false);
        });
      }
    }
    beforeStartingCanvas.hidden = true;


    second = 1;
    minute = 0;
    startTimer();
  }

  //đoạn này là chỉnh on off cái nút flag
  const flagButtonCube = await Scene.root.findFirst("flagButtonCube");
  const materialFlagOn = await Materials.findFirst("flagOn");
  const materialFlagOff = await Materials.findFirst("flagOff");

  //TIME
  const timer = await Scene.root.findFirst("timer");

  //pause
  const pausePulse = await Patches.outputs.getPulse('pausePulse');
  pausePulse.subscribe(()=>{
    minesweeperBoard.hidden= true;
    duringGameCanvas.hidden = true;
      Time.clearInterval(time);
  });
  //unpause
  const continuePulse = await Patches.outputs.getPulse('continuePulse');
  continuePulse.subscribe(()=>{
    minesweeperBoard.hidden= false
    duringGameCanvas.hidden = false;
    startTimer();
  })
  
  //WIN / LOSE
  const winCanvas = await Scene.root.findFirst("win");
  const loseCanvas = await Scene.root.findFirst("lose");
  const duringGameCanvas = await Scene.root.findFirst("duringGame");
  const turnOffWinCanvas = await Patches.outputs.getPulse("turnOffWinCanvas");
  turnOffWinCanvas.subscribe(()=>{
    if(gameOver && win) {
      winCanvas.hidden = true;
    }
  })
  const turnOnWinCanvas = await Patches.outputs.getPulse("turnOnWinCanvas");
  turnOnWinCanvas.subscribe(()=>{
    if(gameOver && win) {
      winCanvas.hidden = false;
    }
  })
  //UNDO
  const undoCube = await Scene.root.findFirst("undoCube")
  const undoButton = await Patches.outputs.getPulse("undoButton")
  const undoDownMat = await Materials.findFirst("undoDown");
  const undoUpMat = await Materials.findFirst("undoUp");
  
  undoButton.subscribe(()=>{
    undoCanvas.hidden= true
    loseCanvas.hidden = true
    coverMine();
    if(loseByOpenByNum) {
      let latestStep = autoExpandTiles[autoExpandTiles.length-1];
      autoExpandTiles.pop();
      for(let i = latestStep.length-1;i>=0;i--) {

        let r = parseInt(latestStep[i].split("-")[0]);
        let c = parseInt(latestStep[i].split("-")[1]);

        if(i==0) {
          board[r][c][12] = false;
          break;
        }
        coverTile(r,c)
      }
      loseByOpenByNum = false;
    } else {
      tilesClicked--;
      //nếu dính bom thì tiếp tục count sau khi bị đứng
    }
    duringGameCanvas.hidden=false;
    startTimer();
  })
  const undoCanvas = await Scene.root.findFirst("undoCanvas");


  //RESTART GAME
  const restartTransition = await Scene.root.findFirst("restartTransition");
  const resetGame = await Patches.outputs.getPulse("resetGame");
  resetGame.subscribe(async ()=>{

    autoExpandTiles = [];
    tilesClicked = 0;
    win = false;
    if(gameOver) coverMine();

    loseCanvas.hidden=true;
    minesweeperBoard.hidden=true;
    duringGameCanvas.hidden=true;
    undoCanvas.hidden= true

    for(let i = 0;i<rows;i++) {
      for(let j = 0;j<cols;j++) {
        if(board[i][j][10]) {
          Scene.destroy(board[i][j][10])
          board[i][j][10] = null;
        }
        board[i][j][11] = false;
        board[i][j][4] = false;
        board[i][j][12] = false;
        if(board[i][j][1]) {
          Scene.destroy(board[i][j][6])
          board[i][j][1]=false;
        }

        board[i][j][8].hidden=false;
        board[i][j][9].hidden=true;
        
      }
    }

      timer.text = "00:00"
      minute = 0;
      second = 1;
      startTimer();
      duringGameCanvas.hidden=false;
      restartTransition.hidden= true;
      minesweeperBoard.hidden=false;

  })

  // NEW GAME
  
  const newGameTransition = await Scene.root.findFirst("newGameTransition");
  const newGame = await Patches.outputs.getPulse("newGame");
  newGame.subscribe(setNewGame)

  function setNewGame() {
    autoExpandTiles=[]
    autoExpandTiles.length = 0;
    if(gameOver) coverMine()
    tilesClicked = 0;
    win = false

    minesweeperBoard.hidden=true;

    emitter.hidden = true;
    emitter0.birthrate = 0;
    emitter1.birthrate = 0;
    emitter2.birthrate = 0;

    winCanvas.hidden = true;    
    loseCanvas.hidden = true;
    duringGameCanvas.hidden=true;
    undoCanvas.hidden= true;


    for(let i = 0;i<rows;i++) {
      for(let j = 0;j<cols;j++) {
        if(board[i][j][10]) {
          Scene.destroy(board[i][j][10])
          board[i][j][10] = false;
        }
        board[i][j][11] = false;
        board[i][j][4] = false;
        board[i][j][3] = 0;
        board[i][j][2] = false;
        board[i][j][12] = false;
        if(board[i][j][1]) {
          Scene.destroy(board[i][j][6])
          board[i][j][1]=false;
        }

        board[i][j][8].hidden=false;
        board[i][j][9].hidden=true;
        
      }
    }
      minesLocation = []
      setMines(minesLocation);

      timer.text = "00:00"
      minute = 0;
      second = 1;
      startTimer();
      duringGameCanvas.hidden=false;
      newGameTransition.hidden= true;
      minesweeperBoard.hidden=false;
  }


  //change difficulty
  const changeDifficulty = await Patches.outputs.getPulse("changeDifficulty");
  changeDifficulty.subscribe(async ()=>{
    board = [];
    let tempBoard = await Scene.root.findFirst("board");
    Scene.destroy(tempBoard);

    minesLocation = []

    // duringGameCanvas.hidden = true;
    emitter.hidden = true;
    emitter0.birthrate = 0;
    emitter1.birthrate = 0;
    emitter2.birthrate = 0;

    winCanvas.hidden = true;    
    loseCanvas.hidden=true;
    introCanvas.hidden =false;
    undoCanvas.hidden= true;
    tilesClicked = 0;
  })

  //--------------------------------------------------------------
  
  async function setGameMode(r,c,m) {
    Diagnostics.log("let's render !!!!!!!")
    autoExpandTiles = [];
    autoExpandTiles.length = 0;
    win = false;
    gameOver = false;
    let tempBoard = await Scene.create("SceneObject", {
      "name": "board",
    })
    minesweeperBoard.addChild(tempBoard); 

    renderingSign.hidden = false; //hiện rendering trong lúc chờ
    introCanvas.hidden = true;
    numberOfMines = m; 
    rows = r;
    cols = c;
    var boardHeight = (rows-1) * tileDistance;
    var boardWidth = (cols-1) * tileDistance;

    for(let i = 0;i<rows;i++) {
      board[i] = [];
    }
    for (let i = 0;i<rows;i++) {
      for(let j = 0;j<cols;j++) {
        board[i][j]=[]
        //0 là tile - object
        //1 là flag - boolean
        //2 là mìn  - boolean
        //3 là number - int 0-8
        //4 open hay chưa - boolean
        // 6 la flag
        // 7 la mine
        // 8 la unopenedCube
        // 9 la openedCube
        // 10 numTil
      }
    }
      //tạo ra các tiles, và gán cho mảng 2d board
    for (let i = 0;i<rows;i++) {
      for (let j = 0;j<cols;j++){

          let tile = await Scene.create("SceneObject", {"name" : "tile "+i+"-"+j})
          let tileCube = await Blocks.instantiate("cube",{"name": "cube "+i+"-"+j})
          board[i][j][0] = tile;
          tempBoard.addChild(tile);
          tile.addChild(tileCube);

          let openedTileCube = await Blocks.instantiate("openedCube",{"name": "openedCube "+i+"-"+j})
          openedTileCube.hidden = true;
          tile.addChild(openedTileCube);


          board[i][j][8] = tileCube;
          board[i][j][9] = openedTileCube;

      }
    }

    var y = - boardWidth/2;
    var x = - boardHeight/2;
    for (let i = 0;i<rows;i++) {
      for(let j = 0;j<cols;j++) {
        board[i][j][0].transform.x = y
        y=y+0.06;
      }
      y= - boardWidth/2
    }

    for (let j = 0;j<cols;j++) {
      for(let i = 0;i<rows;i++) {
        board[i][j][0].transform.z = x
        x=x+0.06;
      }
      x = - boardHeight/2
    }

    Diagnostics.log("finish rendering board")
    renderingSign.hidden = true; //giấu rendering
    //hiện start button
    beforeStartingCanvas.hidden = false;
    
    //tạo mìn

    setMines(minesLocation);
    minesweeperBoard.hidden= false;
  }

  //tạo mìn
  function setMines(minesLocation) {
    let minesLeft = numberOfMines; //set số lượng bom cần cài
    while(minesLeft>0) {
        let r = Math.floor(Math.random()*rows);
        let c = Math.floor(Math.random()*cols);
        let id = r.toString() + "-" + c.toString();
        // nếu tọa độ chưa có thì push vào
        if(!minesLocation.includes(id)) {
            minesLocation.push(id);
            minesLeft -=1;
            //mỗi lần cài thì -1 cái mine cần cài
        }
    }

    // let debug =[]
    // for(let i = 0;i<rows;i++) {
    //     debug.push([])
    // }

    Diagnostics.log(minesLocation)
    for(let i = 0;i<minesLocation.length;i++) {
      let coord = minesLocation[i].split("-")
      let r = parseInt(coord[0]);
      let c = parseInt(coord[1]);
  
      board[r][c][2] = true;


    }
    //set num
    for(let i = 0;i<rows;i++) {
      for(let j = 0;j<cols;j++) {
        setNum(i,j,minesLocation);
        // debug[i][j]=board[i][j][2]
      }
    }
    // Diagnostics.log(debug)
  }


  async function drawMine() {
    for(let i = 0;i<minesLocation.length;i++) {
      let coord = minesLocation[i].split("-")
      let r = parseInt(coord[0]);
      let c = parseInt(coord[1]);
      try {
        let mineObj = await Blocks.instantiate("mine", {"name":"mine"+r+c})
        board[r][c][7]=mineObj;
        board[r][c][0].addChild(mineObj);
      } catch(error){}
    }
    undoCanvas.hidden=false;
    loseCanvas.hidden = false;
  }

  //click FLAG mode
  function clickFlagButton() {
    if(flagMode) {
      flagMode = false;
      flagButtonCube.material = materialFlagOff
    }
    else {
      flagMode = true;
      flagButtonCube.material = materialFlagOn
    }
    Diagnostics.log("FLAG: "+flagMode)
  }

  async function flagTile(r,c) {
      var flag = await Blocks.instantiate("flag", {
        "name" : "flag " + r + "-" + c
      })
        board[r][c][1] = true;
        board[r][c][0].addChild(flag);
        board[r][c][6]=flag;

  }

  async function unflagTile(r,c) {
      // let flag = await Scene.root.findFirst("flag "+ r.toString() + "-" + c.toString())
      board[r][c][1] = false;
      Scene.destroy(board[r][c][6]);
      board[r][c][6] = null; 
  }

  //CLICK TILE
  async function clickTile(r,c,autoExpand) {
    if ( r < 0 || r >= rows || c <0 || c >= cols) return; //tọa độ ngu

    //cắm cờ chỉ khi flagMode true và tile chưa mở
    if (!gameOver && flagMode && !board[r][c][4]) {
      if(!board[r][c][1]) {
        flagTile(r,c);


      } 
      else if(board[r][c][1]) {
        unflagTile(r,c)
      }
      return;
    } 
      //flag mode off
      //game chưa over
      //chưa flagged
      //chưa mở board[r][c][4] true/false

    if (!flagMode && gameOver == false && !board[r][c][1] && !board[r][c][4]) {
  
        tilesClicked++;
        if(!board[r][c][4]) {
          openTileSound.setPlaying(true)
          openTileSound.reset()
        }
        board[r][c][4] = true;
        
        if (autoExpand) {
          board[r][c][11] = true;
          autoExpandTiles[autoExpandTiles.length-1].push(r.toString()+"-"+c.toString());
        }
        //dính bom
        if(minesLocation.includes(r.toString()+"-"+c.toString())) {
                
          blow(r,c);
          return;

        } else {
            drawNum(r,c)

            //khi chưa hiện số thì mới làm
            longTouchGestureSub = TouchGestures.onLongPress(board[r][c][0]).subscribe(()=>{
              //mở bằng num
              if(board[r][c][12]) return;
              if(checkAdjacentFlags(r,c)) autoOpenAdjacentCells(r,c);
              board[r][c][12] = true;
            })
            
            if(board[r][c][3]==0 && !board[r][c][2]) {

              clickTile(r-1,c-1,autoExpand)
              clickTile(r-1,c,autoExpand)
              clickTile(r-1,c+1,autoExpand)

              clickTile(r,c-1,autoExpand)
              clickTile(r,c+1,autoExpand)

              clickTile(r+1,c-1,autoExpand)
              clickTile(r+1,c,autoExpand)
              clickTile(r+1,c+1,autoExpand)
          }

          //WIN NÈ!!!!!!!!!!!
          if(tilesClicked == rows * cols - numberOfMines && !gameOver) {
            Time.clearInterval(time);
            let winTimeText = await Scene.root.findFirst("winTimeText");
            if(minute <10) {
              if (second < 10 ) winTimeText.text = "0"+minute.toString() +":"+ +"0"+second.toString();
              else winTimeText.text = "0"+ minute.toString() +":"+second.toString();
            }
            else if (minute >=10) {
              if (second < 10 ) winTimeText.text = minute.toString() +":"+ +"0"+second.toString();
              else winTimeText.text = minute.toString()+":"+second.toString();
            }
            duringGameCanvas.hidden = true;
            winCanvas.hidden = false;
            gameOver = true;
            win = true;
            emitter.hidden=false;
            emitter0.birthrate = 150;
            emitter1.birthrate = 150;
            emitter2.birthrate = 150;
          }
        }

      }

  }


  function checkAdjacentFlags(i, j) {
    let adjacentFlags = 0;

    // Kiểm tra các ô xung quanh
    for (let r = i - 1; r <= i + 1; r++) {
      for (let c = j - 1; c <= j + 1; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
                if (board[r][c][1]) {
                    adjacentFlags++;
                }
            }
        }
    }

    return adjacentFlags === board[i][j][3]
  }

  function autoOpenAdjacentCells(i,j){
   
    let temp = 0;
    let numOfSurTiles=0;
    for(let r = i-1;r<=i+1;r++) {
      for(let c = j-1;c<=j+1;c++) {
        if(r>=0 && r<rows && c>=0 && c<cols) {
          if(!(r==i && c==j)) {
            numOfSurTiles++;
            if(board[r][c][4] || board[r][c][1]) temp++;
          }
        }
      }
    }
    if(temp<numOfSurTiles) {
      autoExpandTiles.push([]);
      autoExpandTiles[autoExpandTiles.length-1].push(i+"-"+j)
    
      for (let r = i - 1; r <= i + 1; r++) {
        for (let c = j - 1; c <= j + 1; c++) {
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
              if (!board[r][c][4] && !board[r][c][1]) {
                if (board[r][c][2]) {
                    blow(r,c);
                    loseByOpenByNum = true;

                    return;
                } else {
                  let temp = 0;
                  if(flagMode) {
                    flagMode = false;
                    temp = 1;
                  }


                  if(!board[r][c][4]) {
                    clickTile(r,c,true)
                  }
                  
                  if(temp) flagMode = true;
                }
            }
          }
        }
      }
    }
  Diagnostics.log(autoExpandTiles);
  }

  //cài num sau khi cài mìn
  function setNum(r,c,minesLocation) {
    let numOfMineSurrounding = 0;
    if (minesLocation.includes(r.toString()+"-"+c.toString())) return;
    
    if(!( r-1 < 0 || r-1 >= rows || c-1 <0 || c-1 >= cols)&&board[r-1][c-1][2]) 
    numOfMineSurrounding++
    if(!( r-1 < 0 || r-1 >= rows || c <0 || c >= cols)&&board[r-1][c][2]) 
    numOfMineSurrounding++
    if(!( r-1 < 0 || r-1 >= rows || c+1 <0 || c+1 >= cols)&&board[r-1][c+1][2]) 
    numOfMineSurrounding++

    if(!( r < 0 || r >= rows || c-1 <0 || c-1 >= cols)&&board[r][c-1][2]) 
    numOfMineSurrounding++
    if(!( r < 0 || r >= rows || c+1 <0 || c+1 >= cols)&&board[r][c+1][2])
    numOfMineSurrounding++

    if(!( r+1 < 0 || r+1 >= rows || c-1 <0 || c-1 >= cols)&&board[r+1][c-1][2]) 
    numOfMineSurrounding++
    if(!( r+1 < 0 || r+1 >= rows || c <0 || c >= cols)&&board[r+1][c][2]) 
    numOfMineSurrounding++
    if(!( r+1 < 0 || r+1 >= rows || c+1 <0 || c+1 >= cols)&&board[r+1][c+1][2]) 
    numOfMineSurrounding++

    board[r][c][3] = numOfMineSurrounding;
  }

  async function drawNum(r,c) {
      board[r][c][8].hidden = true;
      board[r][c][9].hidden=false;
      let numTile = await Blocks.instantiate("number"+board[r][c][3].toString(),{
        "name":"numOfTile"+r+c
      })
      // numTile.hidden = false;
      board[r][c][0].addChild(numTile)
      
      numTile.worldTransform.rotation = DeviceMotion.worldTransform.rotation
      board[r][c][10] = numTile;
      board[r][c][10].hidden = false;
    
  }


  async function blow(r,c) {

    duringGameCanvas.hidden = true;
    gameOver=true;
    revealMines(r,c,minesLocation);
    Time.clearInterval(time);

    //tạo vụ nổ
    try{
      let explosion = await Blocks.instantiate("explosion", {"name" : "explosionTuan"})
      EXPLOSION = explosion;
      board[r][c][0].addChild(explosion);
    }catch(error){}

    Diagnostics.log("Game Over!!!")

    Diagnostics.log("tile clicked: "+tilesClicked)
  }

  //TIIIIIIIIIIIME!!!!!!!!!!!!!!

  var time;
  function startTimer() {
    time = Time.setInterval(()=>{
      if(second >= 60) {
        second = 0;
        minute++;
      }
    // if (minute < 10) {
    //   minute = "0" + minute;
    // }
    if(minute <10) {
      if (second < 10 ) timer.text = "0"+minute.toString() +":"+ +"0"+second.toString();
      else timer.text = "0"+ minute.toString() +":"+second.toString();
    }
    else if (minute >=10) {
      if (second < 10 ) timer.text = minute.toString() +":"+ +"0"+second.toString();
      else timer.text = minute.toString()+":"+second.toString();
    }
    second++;
  }, 1000)
}

  async function revealMines(clickedMineR,clickedMineC,minesLocation) {
    drawMine(minesLocation)
    
  }

  async function coverMine() {
        gameOver = false;

        Scene.destroy(EXPLOSION);
      for(let i = 0;i<minesLocation.length;i++) {
        
        let coord = minesLocation[i].split("-")
        let r = parseInt(coord[0]);
        let c = parseInt(coord[1]);

        board[r][c][4]= false;

        Scene.destroy(board[r][c][7])
        board[r][c][8].hidden = false;
        board[r][c][9].hidden = true;
    }
  }

  function coverTile(r,c) {
    if ( r < 0 || r >= rows || c <0 || c >= cols) return;
    if(board[r][c][4] && board[r][c][11] && !board[r][c][2]) {
      board[r][c][4]= false; //set lại chưa mở

      board[r][c][11] = false; //set openbynum lại false
      tilesClicked--;
      board[r][c][12] = false;
      Scene.destroy(board[r][c][10]); // xóa numTile
      board[r][c][10] = false;

      board[r][c][9].hidden = true; // giấu tile đã mở
      board[r][c][8].hidden = false; // hiện lại tile chưa mở
    }
  }

})(); // Enables async/await in JS [part 2]
