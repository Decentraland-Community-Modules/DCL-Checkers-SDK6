/*     GAME MANAGER
    this module is used to manage the initialization and processing
    of a single checker board. this holds all tiles/markers and handles
    network processing.

    Author: Alex Pazder, thecryptotrader69@gmail.com
*/
import * as utils from '@dcl/ecs-scene-utils'
import { MenuBuilder } from './MenuBuilder';
import { PlayerIdentifier } from "./PlayerIdentifier";
import { CheckerMarkerPool, CheckerMarker, ActionMarker } from "./CheckerMarkerPooling";
@Component("CheckerBoard")
export class CheckerBoard extends Entity
{
  //debugging setting
  public static IsDebugging:boolean;
  //debugging with many statements
  public static IsVerbose:boolean;

  /* BOARD SETTINGS */
  private index:number;
  public Index()
  {
    return this.index;
  }
  //size of gameboard to be generated
  private grid_size_x:number = 8;
  private grid_size_y:number = 8;
  //change position of gameboard
  public SetPosition(x:number, y:number, z:number)
  {
    this.getComponent(Transform).position = new Vector3(x, y, z);
  }

  /* GAME STATES & STATS */
  //  game states: 
  //    0 ilde: game is waiting for users to register and begin
  //    1 in-session: game is being played by active users
  //    2 completed: game has finished, resolution is left for study
  private game_state:number = 0;
  public GameState() { return this.game_state; }
  //current turn
  private game_turn:number = 0;
  nextGameTurn() 
  { 
    //push next turn
    this.game_turn++; 
    if(this.game_turn > 1) 
    {
      this.game_turn = 0; this.updateGameTurn(); 
    }
    
    //update turn ui
    this.updateGameTurn();
    
    if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
      log("new turn started, now "+this.team_name[this.game_turn]+"'s turn"); }
  }
  setGameTurn(turn:number) { this.game_turn = turn; this.updateGameTurn(); }
  //markers per team
  private marker_count_per_team = 12;
  //team strings and materials
  private team_name:string[] = ["Red","Blue"];
  private team_material:Material[] = [new Material(),new Material()];
  //any currently registered users (id in string form)
  private registered_users_id:string[] = ["", ""];
  private registered_users_name:string[] = ["", ""];
  //number of markers alive for each team
  private team_markers:number[] = [0,0];
 
  //true if a marker has been captured this turn
  markerJumped:boolean = false;
  //number of markers captured this turn
  markerJumpedKills:number = 0;

  /*3D INTERACTION COMPONENTS WITH TEXT DISPLAYS*/
  private menuBuilder:MenuBuilder = new MenuBuilder();
  private tag_title:string = "CHECKERS";
  private tag_state:string = "GAME_STATE";
  private tag_team:string = "TEAM";
  private tag_registry:string = "REGISTRY";
  private tag_markers:string = "MARKERS";
  private tag_control_reset:string = "RESET";
  private tag_control_play:string = "PLAY";
  private control_parent = new Entity();
  private control_registered_players:Entity[] = [new Entity(), new Entity()];
  private control_register_buttons:Entity[] = [new Entity(), new Entity()];
  private control_start_button:Entity = new Entity();

  //create 3d control panel
  prepareMenu()
  {
    if(CheckerBoard.IsDebugging){ log("initializing 3d menu for checker board: "+this.index.toString()+"..."); }
    //place menu as a child of the board
    this.menuBuilder.setParent(this);
    this.menuBuilder.getComponent(Transform).position = new Vector3(-1.4,1.1,0);
    this.menuBuilder.getComponent(Transform).scale = new Vector3(0.25,0.25,0.25);
    this.menuBuilder.getComponent(Transform).rotate(Axis.Y, 270);

    //create title label
    this.menuBuilder.AddMenu(2, this.tag_title, this.tag_title);
    this.menuBuilder.SetMenuPosition(this.tag_title.toString(), new Vector3(0, 2, 0));
    
    //create state label
    this.menuBuilder.AddMenu(2, this.tag_state, this.tag_state);
    this.menuBuilder.SetMenuPosition(this.tag_state.toString(), new Vector3(0, 0, 0));

    //prepare buttons per team
    for (let i = 0; i < this.control_register_buttons.length ; i++) 
    {
      //build team label
      this.menuBuilder.AddMenu(2, this.tag_team+i.toString(), this.team_name[i]);
      this.menuBuilder.SetMenuPosition(this.tag_team+i.toString(), new Vector3((i*3)-1.5, -1.5, 0));
      this.menuBuilder.SetMenuScale(this.tag_team+i.toString(), new Vector3(0.5, 0.5, 1));

      //build registry buttons
      this.menuBuilder.AddMenu(2, this.tag_registry+i.toString(), "Empty");
      this.menuBuilder.SetMenuPosition(this.tag_registry+i.toString(), new Vector3((i*3)-1.5, -2.5, 0));
      this.menuBuilder.SetMenuScale(this.tag_registry+i.toString(), new Vector3(0.5, 0.5, 1));
      //add click action listener
      this.menuBuilder.GetMenu(this.tag_registry+i).addComponent
      (
        new OnPointerDown
        (
          (e) => 
          {
            //users cannot change registration when game is in-session
            if(this.game_state != 1)
            {
              //register this user to the board
              this.RegisterPlayer(i);
            }
          },
          { 
            button: ActionButton.POINTER,
            showFeedback: true,
            hoverText: "Register"
          }
        )
      );

      //build marker count labels
      this.menuBuilder.AddMenu(2, this.tag_markers+i.toString(), "Markers: 12");
      this.menuBuilder.SetMenuPosition(this.tag_markers+i.toString(), new Vector3((i*3)-1.5, -3.5, 0));
      this.menuBuilder.SetMenuScale(this.tag_markers+i.toString(), new Vector3(0.5, 0.5, 1));
    }
    
    //build reset button
    this.menuBuilder.AddMenu(2, this.tag_control_reset, "Reset");
    this.menuBuilder.SetMenuPosition(this.tag_control_reset, new Vector3(1.5, -4.3, -0.4));
    this.menuBuilder.SetMenuRotation(this.tag_control_reset, new Vector3(0.5, 0, 0));
    this.menuBuilder.SetMenuScale(this.tag_control_reset, new Vector3(0.5, 0.5, 1));
    //add click action listener
    this.menuBuilder.GetMenu(this.tag_control_reset).addComponent
    (
      new OnPointerDown
      (
        (e) => 
        { 
          this.RestartBoard();
        },
        { 
          button: ActionButton.POINTER,
          showFeedback: true,
          hoverText: "Reset"
        }
      )
    );

    //build start button
    this.menuBuilder.AddMenu(2, this.tag_control_play, "Start");
    this.menuBuilder.SetMenuPosition(this.tag_control_play, new Vector3(-1.5, -4.3, -0.4));
    this.menuBuilder.SetMenuRotation(this.tag_control_play, new Vector3(0.5, 0, 0));
    this.menuBuilder.SetMenuScale(this.tag_control_play, new Vector3(0.5, 0.5, 1));
    //add click action listener
    this.menuBuilder.GetMenu(this.tag_control_play).addComponent
    (
      new OnPointerDown
      (
        (e) => 
        { 
          this.StartBoard();
        },
        { 
          button: ActionButton.POINTER,
          showFeedback: true,
          hoverText: "Play"
        }
      )
    );
  }
  //update user names
  updateUserName() 
  {  
    for (let i = 0; i < 2; i++) 
    {
      if(this.registered_users_id[i] == "")
      {
        this.menuBuilder.SetMenuText(this.tag_registry+i,"Empty");
      }
      else
      {
        this.menuBuilder.SetMenuText(this.tag_registry+i,this.registered_users_name[i]);
      }
    }
  }
  //update team's markers
  updateUserMarkers() 
  {  
    for (let i = 0; i < 2; i++) 
    {
      this.menuBuilder.SetMenuText(this.tag_markers+i.toString(),"Markers: "+this.team_markers[i].toString());
    }
  }
  //update turn display
  updateGameTurn()
  {
    this.menuBuilder.SetMenuText(this.tag_state, this.team_name[this.game_turn]+"'s Turn");
  }

  /*CHECKER MARKER POOLING*/
  //pool used to manage all markers, it takes in this board as
  //  its owner/manager and automatically generates the required
  //  markers when it is first created 
  private marker_pool:CheckerMarkerPool = new CheckerMarkerPool();

  /* ACCESS FUNCTIONS */
  //used to standardize indexing of markers
  public GetMarkerIndex(team:number, index:number)
  {
    return team.toString()+"_"+index.toString();
  }
  //ensures existance of marker, this will only really hit a failure if some
  //  attempts to cheat.
  doesMarkerExsist(team:number, index:number)
  {
    //ensure team and marker index are in-bounds
    if(0 <= team && team < 2 && 0 <= index && index < this.marker_count_per_team){ return true; }
    //if this fails we have a cheater...
    return false;
  }

  //initializes manager, creating menus, materials, and
  // preparing it for map generation
  constructor(uid:number)
  {
    //initialize object
    super();
    
    //enable debugging log
    CheckerBoard.IsDebugging = true;
    CheckerBoard.IsVerbose = true;
    CheckerMarkerPool.IsDebugging = true;
    CheckerMarkerPool.IsVerbose = false;

    if(CheckerBoard.IsDebugging){ log("initializing checker board: "+uid.toString()+"..."); }
    //assign board's index
    this.index = uid;

    //prepare materials for teams
    this.team_material[0].albedoColor = Color3.Red();
    this.team_material[1].albedoColor = Color3.Blue();

    //prepare board's networking calls
    //  user requesting registration to board
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_rur_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure this is only processed by the source
        if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
        {
          var tmp = info.action.split('_');
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ log("MESSAGE BUS RECEIVE: user registry call "+tmp[0]); }
          
          //ensure board is not in-session
          if(this.game_state != 1)
          {
            //check if a null-name was provided (removal request)
            if(tmp[0] == "")
            {
              var key = "cb_rura_"+this.index.toString();
              //prepare the data capsule
              this.send.sender = PlayerIdentifier.USER_DATA.userId;
              this.send.action = tmp[1];
  
              //send update to all users in-scene
              PlayerIdentifier.MESSAGE_BUS.emit(key, this.send);
            }
            //check if user exists on the requested team (removal request)
            else if(this.send.sender == this.registered_users_id[+tmp[1]])
            {
              var key = "cb_rura_"+this.index.toString();
              //prepare the data capsule
              this.send.sender = PlayerIdentifier.USER_DATA.userId;
              this.send.action = tmp[1];
  
              //send update to all users in-scene
              PlayerIdentifier.MESSAGE_BUS.emit(key, this.send);
            }
            else
            {
              var key = "cb_rua_"+this.index.toString();
              //prepare the data capsule
              this.send.sender = PlayerIdentifier.USER_DATA.userId;
              this.send.action = info.sender+"_"+tmp[0]+"_"+tmp[1];
  
              //send update to all users in-scene
              PlayerIdentifier.MESSAGE_BUS.emit(key, this.send);
            }
          }
        }
      }
    );
    //  user request has been accepted by source, emitting user registration
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_rua_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure the sender is the source
        if(info.sender == PlayerIdentifier.TRUSTED_SOURCE)
        {
          var tmp = info.action.split('_');
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ log("MESSAGE BUS RECEIVE: user being added to team:"+tmp[2]); }
          
          //if this is the origional requester
          if(tmp[0] == PlayerIdentifier.USER_DATA.userId)
          {
            //assign team and board to player
            PlayerIdentifier.USER_TEAM = +tmp[2];
            PlayerIdentifier.USER_BOARD = this.index;
          }
      
          //record new registrant's info on board
          this.registered_users_id[+tmp[2]] = tmp[0];
          this.registered_users_name[+tmp[2]] = tmp[1];
          
          //update user names
          this.updateUserName();
        }
        else
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: command from invalid source"); }
        }
      }
    );
    //  user request has been accepted by source, emitting user unregistration
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_rura_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure the sender is the source
        if(info.sender == PlayerIdentifier.TRUSTED_SOURCE)
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ log("MESSAGE BUS RECEIVE: user being removed from team:"+info.action); }
          
          //record new registrant's info on board
          this.registered_users_id[+info.action] = "";
          this.registered_users_name[+info.action] = "";
          
          //update user names
          this.updateUserName();
        }
        else
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: command from invalid source"); }
        }
      }
    );

    //  user requesting board start
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_sbr_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure this is only processed by the source
        if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: user requesting board start"); }

          //ensure user is part of the board
          if(this.registered_users_id[0] == PlayerIdentifier.USER_DATA.userId 
            || this.registered_users_id[1] == PlayerIdentifier.USER_DATA.userId)
          {
            //ensure there are 2 users registered to the board
            if(this.registered_users_id[0] != "" && this.registered_users_id[1] != "")
            {
              if(CheckerBoard.IsDebugging){ log("host accepts board start");}

              //send acceptance
              this.send.sender = PlayerIdentifier.USER_DATA.userId;
              this.send.action = ""; 
              PlayerIdentifier.MESSAGE_BUS.emit("cb_sba_"+this.index.toString(), this.send);
            }
          }
        }
      }
    );
    //  user request has been accepted by source, emitting board start
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_sba_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure the sender is the source
        if(info.sender == PlayerIdentifier.TRUSTED_SOURCE)
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: source has accepted demand, board start process"); }

          //if game is idle/over, start a new game session
          if(this.game_state != 1)
          {
            this.ChangeGameState(1);
          }
          //end current game 
          else
          {
            this.ChangeGameState(0);
          } 
        }
        else
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: command from invalid source"); }
        }
      }
    );

    //  user requesting board restart
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_rbr_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure this is only processed by the source
        if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: user requesting board restart"); }

          //ensure user is part of the board
          if(this.registered_users_id[0] == PlayerIdentifier.USER_DATA.userId 
            || this.registered_users_id[1] == PlayerIdentifier.USER_DATA.userId)
          {
            if(CheckerBoard.IsDebugging){ log("host accepts board restart");}

            //send acceptance
            this.send.sender = PlayerIdentifier.USER_DATA.userId;
            this.send.action = ""; 
            PlayerIdentifier.MESSAGE_BUS.emit("cb_rba_"+this.index.toString(), this.send);
          }
        }
      }
    );
    //  user request has been accepted by source, emitting board start
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_rba_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure the sender is the source
        if(info.sender == PlayerIdentifier.TRUSTED_SOURCE)
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: source has accepted demand, board restart process"); }

          //if game is in-session, give players the option to restart the game
          if(this.game_state == 1)
          {
            this.ChangeGameState(1);
          }
        }
        else
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: command from invalid source"); }
        }
      }
    );

    //  user requesting marker selection from source
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_smr_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure this is only processed by the source
        if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
        {
          //deserialize
          var deserial = info.action.split('_');
          var posX:number = +deserial[0];
          var posY:number = +deserial[1];
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: user requesting marker ("+posX.toString()+","+posY.toString()+") selection"); }

          //if board is not in-session
          if(this.game_state != 1)
          {
            //if target tile is occupied, select the marker on that tile
            if(this.marker_pool.IsTileOccupied(this.boardHitPos[0], this.boardHitPos[1]))
            {
              if(CheckerBoard.IsDebugging){ log("host accepts marker selection");}
              //send acceptance
              this.send.sender = PlayerIdentifier.USER_DATA.userId;
              this.send.action = posX+"_"+posY; 
              PlayerIdentifier.MESSAGE_BUS.emit("cb_sma_"+this.index.toString(), this.send);
            }
          }
          //if board is in-session
          else
          {
            //ensure it is the sender's turn
            if(this.send.sender == this.registered_users_id[this.game_turn])
            {
              //ensure tile is occupied by a marker owned by the sender
              if(this.marker_pool.IsTileOccupied(this.boardHitPos[0], this.boardHitPos[1])
              && this.game_turn == this.marker_pool.GetMarkerByPosition(this.boardHitPos[0], this.boardHitPos[1]).Team()
              )
              {
                if(CheckerBoard.IsDebugging){ log("host accepts marker selection");}
                //send acceptance
                this.send.sender = PlayerIdentifier.USER_DATA.userId;
                this.send.action = posX+"_"+posY; 
                PlayerIdentifier.MESSAGE_BUS.emit("cb_sma_"+this.index.toString(), this.send);
              }
            }
          }
        }
      }
    );
    //  user request has been accepted by source, emitting marker selection
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_sma_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure the sender is the source
        if(info.sender == PlayerIdentifier.TRUSTED_SOURCE)
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: source has accepted demand, selecting marker"); }

          //get values
          var deserial = info.action.split('_');
          var posX:number = +deserial[0];
          var posY:number = +deserial[1];
          //select marker
          this.marker_pool.SelectMarker(this.markerJumped, +deserial[0], +deserial[1]);
        }
        else
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: command from invalid source"); }
        }
      }
    );

    //  user requesting marker movement from source
    PlayerIdentifier.MESSAGE_BUS.on
    (
        "cb_mmr_"+this.index.toString(),
        (info : ActionCapsule) =>
        {
          //ensure this is only processed by the source
          if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
          {
            //ensure there is a marker selected
            if(this.marker_pool.HasSelectedMarker())
            {
              //deserialize
              var deserial = info.action.split('_');
              var posX:number = +deserial[0];
              var posY:number = +deserial[1];
              if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
                log("MESSAGE BUS RECEIVE: user requesting marker movement"); }
            
              //if board is not in-session
              if(this.game_state != 1)
              {
                //target tile is not occupied and a marker is selected, move that marker to a location 
                if(!this.marker_pool.IsTileOccupied(posX, posY))
                {
                  if(CheckerBoard.IsDebugging){ log("board moving marker");}
                  //load capsule and emit selection request
                  this.send.sender = PlayerIdentifier.USER_DATA.userId;
                  this.send.action = posX+"_"+posY; 
                  PlayerIdentifier.MESSAGE_BUS.emit("cb_mma_"+this.index.toString(), this.send);
                }
              }
              //if board is in-session
              else
              {
                //ensure it is the sender's turn
                if(this.send.sender == this.registered_users_id[this.game_turn])
                {
                  //ensure target location is a verified action marker
                  if(this.marker_pool.IsLocationOnActionMarker(this.boardHitPos[0], this.boardHitPos[1]))
                  {
                    if(CheckerBoard.IsDebugging){ log("board moving marker");}
                    //load capsule and emit selection request
                    this.send.sender = PlayerIdentifier.USER_DATA.userId;
                    this.send.action = posX+"_"+posY; 
                    PlayerIdentifier.MESSAGE_BUS.emit("cb_mma_"+this.index.toString(), this.send);
                  }
                }
              }
            }
            else
            {
              if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
                log("MESSAGE BUS REQUEST FAILED: no marker selected"); }
            }
          }
          else
          {
            if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
              log("MESSAGE BUS REQUEST FAILED: not user's turn"); }
          }
        }
    );
    //  user request has been accepted by source, emitting marker movement
    PlayerIdentifier.MESSAGE_BUS.on
    (
      "cb_mma_"+this.index.toString(),
      (info : ActionCapsule) =>
      {
        //ensure the sender is the source
        if(info.sender == PlayerIdentifier.TRUSTED_SOURCE)
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: source has accepted demand, moving marker"); }
          
          //deserialize
          var deserial = info.action.split('_');
          var posX:number = +deserial[0];
          var posY:number = +deserial[1];
          
          //if chosen action marker has a jump target
          if(this.marker_pool.ActionMarkerDict.containsKey(this.marker_pool.GetTileIndex(posX,posY)))
          {
            if(this.marker_pool.ActionMarkerDict.getItem(this.marker_pool.GetTileIndex(posX,posY)).HasJumpTarget)
            {
              //remove jump target
              this.CaptureMarker(this.marker_pool.ActionMarkerDict.getItem(this.marker_pool.GetTileIndex(posX,posY)).JumpTarget);
            }
            else
            {
              if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
                log("marker's target tile does not have a jump target"); }
            }
          }
          else
          {
            if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
              log("marker's target tile does not have an action marker"); }
          }

          //move selected marker to target position
          this.marker_pool.MoveSelectedMarker(posX, posY, this.getTilePosition(posX, posY));

          //if game is in-session
          if(this.game_state == 1)
          {
            //attempt to maintain selection of current marker
            this.marker_pool.SelectMarker(false, posX, posY);

            //check if marker has killed this turn and has jump moves remaining
            if(this.markerJumped && this.marker_pool.DoesMarkerHaveActions(true))
            {
              if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
                log("marker still has moves: turn remains"); }
            }
            //marker has no moves remaining, end turn
            else
            {
              if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
                log("marker is out of moves: turn changed"); }

              //drop current marker
              this.marker_pool.DeselectMarker();

              //push next turn
              this.nextGameTurn();

              this.markerJumped = false;
              this.markerJumpedKills = 0;
            }

            //check for win condition
            if(this.team_markers[0] == 0)
            {
              if(CheckerBoard.IsDebugging){ log("checker board: victory for team "+this.team_name[1]); }
        
              this.ChangeGameState(2);
            }
            if(this.team_markers[1] == 0)
            {
              if(CheckerBoard.IsDebugging){ log("checker board: victory for team "+this.team_name[0]); }
        
              this.ChangeGameState(2);
            }
          }
          //if game is not in-session
          else
          {
            //reset kill counters
            this.markerJumped = false;
            this.markerJumpedKills = 0;
          }
        }
        else
        {
          if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ 
            log("MESSAGE BUS RECEIVE: command from invalid source"); }
        }
      }
    );

    //add transform data for positioning and scale
    this.marker_pool.setParent(this);
    this.addComponent(new GLTFShape("models/GameBoard.glb"));
    this.addComponent(new Transform
    ({
      position: new Vector3(0,1,0),
      scale: new Vector3(1,1,1),
      rotation: new Quaternion().setEuler(0,0,0)
    }));
    
    //add functionality
    this.addComponent
    (
      new OnPointerDown((e) => 
      {
        //attempt to update hit position
        this.getBoardHitPosition(e.hit?.hitPoint);

        if(CheckerBoard.IsVerbose) log("user selected position: "+this.boardHitPos[0].toString()+", "+this.boardHitPos[1].toString());

        //attempt an action
        this.ProcessAction();
      },
      { 
        button: ActionButton.POINTER,
        showFeedback: false,
      })
    );

    //create table object
    var tableObj = new Entity();
    tableObj.setParent(this);
    tableObj.addComponent(new GLTFShape("models/GameTable.glb"));
    tableObj.addComponent(new Transform
    ({
      position: new Vector3(0,-1.01,0),
      scale: new Vector3(1,1,1),
      rotation: new Quaternion().setEuler(0,0,0)
    }));


    //ready 3D menu object
    this.prepareMenu();
    this.updateUserName();

    //set game to default state
    this.ResetBoard();
    this.ChangeGameState(0);

    if(CheckerBoard.IsDebugging){ log("checker board: "+uid.toString()+" initialization complete."); }
  }

  //saves the board's current state into the given capsule
  public SaveBoardToSerial(data:BoardCapsule)
  {
    data.sender = PlayerIdentifier.USER_DATA.userId;
    data.id = this.Index();
    //build the board's state serial
    //state
    data.serial_state = this.game_state.toString()+"_";
    //turn
    data.serial_state += this.game_turn.toString()+"_";
    //registered users
    for(let i:number=0; i<this.registered_users_id.length; i++)
    {
      data.serial_state += this.registered_users_id[i].toString()+"_";
      data.serial_state += this.registered_users_name[i].toString()+"_";
    }
    //board position
    data.serial_state += this.getComponent(Transform).position.x.toString()+"_";
    data.serial_state += this.getComponent(Transform).position.y.toString()+"_";
    data.serial_state += this.getComponent(Transform).position.z.toString();
    if(CheckerBoard.IsDebugging){ log("SOURCE: saving board state: "+data.serial_state); }
    
    //build board's marker pool serial
    data.serial_markers_0 = this.marker_pool.SaveToSerial(0);
    if(CheckerBoard.IsDebugging){ log("SOURCE: saving marker positions for team 0: "+data.serial_markers_0); }
    data.serial_markers_1 = this.marker_pool.SaveToSerial(1);
    if(CheckerBoard.IsDebugging){ log("SOURCE: saving marker positions for team 1: "+data.serial_markers_1); }
  }

  //prepares the board based on the provided data capsule
  public LoadBoardFromSerial(data:BoardCapsule)
  {
    if(CheckerBoard.IsDebugging){ log("CLIENT: loading board state: "+data.serial_state); }
    //break down serial
    var deserial:string[] = data.serial_state.split('_');
    
    //state
    this.ChangeGameState(+deserial[0]);
    //turn
    this.game_turn  = +deserial[1];
    //registered users
    for(let i:number=0; i<this.registered_users_id.length; i++)
    {
      this.registered_users_id[i] = deserial[2+(i*2)];
      this.registered_users_name[i] = deserial[3+(i*2)];
    }
    this.updateUserName();
    //board position
    this.SetPosition(+deserial[6],+deserial[7],+deserial[8]);

    if(CheckerBoard.IsDebugging){ log("CLIENT: loading marker positions: "+data.serial_markers_0); }
    //place all markers based on marker pool serial
    //process each marker for team 0
    let deserial_pool:string[] = data.serial_markers_0.split('_');
    this.LoadSerialToBoard(0, deserial_pool);
    //process each marker for team 1
    deserial_pool = data.serial_markers_1.split('_');
    this.LoadSerialToBoard(1, deserial_pool);
  }

  private LoadSerialToBoard(team:number, deserial:string[])
  {
    for(let index:number=0; index<12; index++)
    {
        var deserial_marker:string[] = deserial[index].split(':');
        //set position
        this.marker_pool.MoveMarker(team, index, +deserial_marker[0], +deserial_marker[1], 
          this.getTilePosition(+deserial_marker[0],+deserial_marker[1]));
        //set states
        //we are going to simplify states into numbers to reduce network traffic
        //  is marker catured
        if(deserial_marker[2] == "1") { this.marker_pool.CaptureMarkerByIndex(team, index); }
        //  is marker enhanced
        if(deserial_marker[3] == "1") { this.marker_pool.GetMarkerByTeam(team, index).SetEnhancement(true); }
        else  { this.marker_pool.GetMarkerByTeam(team, index).SetEnhancement(false); }
    }
  }

  //modifies current state of the game
  //    0 ilde: game is waiting for users to register and begin
  //    1 in-session: game is being played by active users
  //    2 completed: game has finished, resolution is left for study
  public ChangeGameState(value:number)
  {
    if(CheckerBoard.IsDebugging){ log("board " + this.index.toString() + " changing state to: " + value.toString()); }

    //deselect current marker
    this.marker_pool.DeselectMarker();

    //cause effect of new state
    switch(value)
    {
      //idle: waiting for players
      case 0:
        //update interface
        this.menuBuilder.SetMenuText(this.tag_state,"Game Open");
        this.menuBuilder.SetMenuText(this.tag_control_play,"Start");
      break;
      //in-session: game is currently being played
      case 1:
        if(CheckerBoard.IsDebugging){ log("starting new game on board: "+this.index.toString()+" with players: "
        +this.team_name[0]+"="+this.registered_users_name[0]+", "
        +this.team_name[1]+"="+this.registered_users_name[1]); }

        //update interface
        this.menuBuilder.SetMenuText(this.tag_state,this.team_name[this.game_turn]+"'s Turn");
        this.menuBuilder.SetMenuText(this.tag_control_play,"End");

        //reset the board
        this.ResetBoard();
      break;
      //completed: game has finished and is now awaiting next contact
      case 2:
        //update interface
        this.menuBuilder.SetMenuText(this.tag_state,this.team_name[this.game_turn]+" Wins");
        this.menuBuilder.SetMenuText(this.tag_control_play,"Start");
      break;
    } 

    //if game is not in session, enhance all markers to allow all action markers
    if(value != 1)
    {
      for (let team=0; team<2; team++) 
      {
        for (let x=0; x < this.marker_count_per_team; x++) 
        {
          this.marker_pool.GetMarkerByTeam(team, x).SetEnhancement(false);
        }
      }
    }
    else
    {
      for (let team=0; team<2; team++) 
      {
        for (let x=0; x < this.marker_count_per_team; x++) 
        {
          this.marker_pool.GetMarkerByTeam(team, x).SetEnhancement(false);
        }
      }
    }

    //assign new state
    this.game_state = value;
  }

  //sets the board into its ready state, all pieces are placed and
  //players are emptied from registry
  public ResetBoard()
  {
    if(CheckerBoard.IsDebugging){ log("resetting checker board: "+this.index.toString()+"..."); }

    //reset current turn
    this.setGameTurn(0);
    
    //hide all action markers
    this.marker_pool.HideActionMarkers();

    //reset marker count
    this.team_markers[0] = this.marker_count_per_team; 
    this.team_markers[1] = this.marker_count_per_team;
    this.updateUserMarkers();

    //position markers for team 1
    // done over the first two rows
    var cur_pos:number[] = [0,0]; 
    for (let x = 0; x < this.marker_count_per_team; x++) 
    {
      //position marker
      var marker = this.marker_pool.MoveMarker(0, x, cur_pos[0], cur_pos[1], this.getTilePosition(cur_pos[0], cur_pos[1]));
      marker.Reset();
      marker.setParent(this);

      //move to next positon
      cur_pos[0] = cur_pos[0]+2;
      //look for end of line
      if(cur_pos[0] >= 8)
      {
        cur_pos[0] = 0;
        cur_pos[1]++;
        //odd rows get bumped to the side
        if(cur_pos[1]%2 == 1)
        {
          cur_pos[0]++;
        }
      }
    }

    //position markers for team 2
    // done over the last two rows
    cur_pos = [1,5]; 
    for (let x = 0; x < this.marker_count_per_team; x++) 
    {
      //position marker
      var marker = this.marker_pool.MoveMarker(1, x, cur_pos[0], cur_pos[1], this.getTilePosition(cur_pos[0], cur_pos[1]));
      marker.Reset();
      marker.setParent(this);

      //move to next positon
      cur_pos[0] = cur_pos[0]+2;
      //look for end of line
      if(cur_pos[0] >= 8)
      {
        cur_pos[0] = 0;
        cur_pos[1]++;
        //odd rows get bumped to the side
        if(cur_pos[1]%2 == 1)
        {
          cur_pos[0]++;
        }
      }
    }

    if(CheckerBoard.IsDebugging){ log("checker board: "+this.index.toString()+" has been reset."); }
  }
  
  //returns the position of a hit in game-space related to location on-board
  //  y pos is not taken into consideration for calc
  //there is a bit of math here, don't get overwhelmed, all its doing is taking
  //  in the hit position of the player's mouse and rescaling/repositioning to
  //  find the relative board-position
  boardHitPosRaw:number[] = [0,0];
  boardHitPos:number[] = [0,0];
  getBoardHitPosition(hit:ReadOnlyVector3|undefined)
  {
    if(hit != undefined)
    {
      var board_position = this.getComponent(Transform).position;
      var board_scale = this.getComponent(Transform).scale;

      //calculate tile square hit
      //  x position
      //    bind position to board
      this.boardHitPos[0] = ((((hit.x - board_position.x)/board_scale.x/2)*this.grid_size_x)+(this.grid_size_x/2));
      //    round off
      this.boardHitPos[0] = Math.floor(this.boardHitPos[0]);
      //    reafix to tile grid
      this.boardHitPosRaw[0] = (((this.boardHitPos[0]+0.5-(this.grid_size_x/2))/this.grid_size_x)*2*board_scale.x)+board_position.x;
      //  y position
      //    bind position to board
      this.boardHitPos[1] = ((((hit.z - board_position.z)/board_scale.z/2)*this.grid_size_y)+(this.grid_size_y/2));
      //    round off
      this.boardHitPos[1] = Math.floor(this.boardHitPos[1]);
      //    reafix to tile grid
      this.boardHitPosRaw[1] = (((this.boardHitPos[1]+0.5-(this.grid_size_y/2))/this.grid_size_y)*2*board_scale.z)+board_position.z;
    }
  }
  
  //returns the in-game location for a tile location
  getTilePosition(x:number, y:number)
  {
    return new Vector3
    (
      (x - (this.grid_size_x/2) + 0.5) * (2/this.grid_size_x),
      0,
      (y - (this.grid_size_y/2) + 0.5) * (2/this.grid_size_y)
    );
  }

  //takes in an action from a user and attempts to process it
  public ProcessAction()
  {
    //if the game is not in-session let the players move markers around however they want
    if(this.game_state != 1)
    {
      //tile contains a marker, attempt to select marker at hit location
      if(this.marker_pool.IsTileOccupied(this.boardHitPos[0], this.boardHitPos[1]))
      {
        if(CheckerBoard.IsDebugging){ log("board selecting marker");}
        //load capsule and emit selection request
        this.send.sender = PlayerIdentifier.USER_DATA.userId;
        this.send.action = this.boardHitPos[0]+"_"+this.boardHitPos[1]; 
        PlayerIdentifier.MESSAGE_BUS.emit("cb_smr_"+this.index.toString(), this.send);
      }
      //target tile is not occupied and a marker is selected, move that marker to a location 
      else if(this.marker_pool.HasSelectedMarker())
      {
        if(CheckerBoard.IsDebugging){ log("board moving marker");}
        //load capsule and emit selection request
        this.send.sender = PlayerIdentifier.USER_DATA.userId;
        this.send.action = this.boardHitPos[0]+"_"+this.boardHitPos[1]; 
        PlayerIdentifier.MESSAGE_BUS.emit("cb_mmr_"+this.index.toString(), this.send);
      }
    }
    //if game is in-session control who can move a marker
    else
    {
      //ensure it is the user's turn and they are part of this board
      if(this.Index() == PlayerIdentifier.USER_BOARD 
       // && this.game_turn == PlayerIdentifier.USER_TEAM
      )
      {
        //tile is occupied and marker is the same team as the user
        if(this.marker_pool.IsTileOccupied(this.boardHitPos[0], this.boardHitPos[1])
          //&& this.marker_pool.GetTileOccupiedOwner(this.boardHitPos[0], this.boardHitPos[1]) == PlayerIdentifier.USER_TEAM
        )
        {
          if(CheckerBoard.IsDebugging){ log("board selecting marker");}
          //emit selection request
          this.send.sender = PlayerIdentifier.USER_DATA.userId
          this.send.action = this.boardHitPos[0]+"_"+this.boardHitPos[1];
          PlayerIdentifier.MESSAGE_BUS.emit("cb_smr_"+this.index.toString(), this.send);
        }
        //a marker is selected, tile is not occupied, and marker is the same team as the user
        else if(this.marker_pool.HasSelectedMarker()
          && this.marker_pool.IsLocationOnActionMarker(this.boardHitPos[0], this.boardHitPos[1])
          //&& this.marker_pool.GetTileOccupiedOwner(this.boardHitPos[0], this.boardHitPos[1]) == PlayerIdentifier.USER_TEAM
        )
        {
          if(CheckerBoard.IsDebugging){ log("board moving marker");}
          //load capsule and emit selection request
          this.send.sender = PlayerIdentifier.USER_DATA.userId;
          this.send.action = this.boardHitPos[0]+"_"+this.boardHitPos[1]; 
          PlayerIdentifier.MESSAGE_BUS.emit("cb_mmr_"+this.index.toString(), this.send);
        }
      }
      else
      {
        if(CheckerBoard.IsDebugging && CheckerBoard.IsVerbose){ log("action failed: user not part of board");}
      }
    }
  }

  //captures a marker, removing it from the board
  public CaptureMarker(pos:number[])
  {
    if(CheckerBoard.IsDebugging){ log("checker board: capturing marker: "+pos[0]+","+pos[1]); }

    this.markerJumped = true;
    this.markerJumpedKills++;

    //capture marker
    this.marker_pool.CaptureMarkerByPos(pos[0], pos[1]);

    //modify score
    if(this.game_turn == 0){ this.team_markers[1]--; }
    else{ this.team_markers[0]--; }
    this.updateUserMarkers();
  }

  //registers user to this board's given team
  send:ActionCapsule = { sender:"", action:"" };
  public RegisterPlayer(team:number)
  {
    if(CheckerBoard.IsDebugging){ log("registering user "+PlayerIdentifier.USER_DATA.userId+" to checker board: "+this.index.toString()+"..."); }
    
    //create key and send data
    var key = "cb_rur_"+this.index.toString();
    
    //prepare the data capsule
    this.send.sender = PlayerIdentifier.USER_DATA.userId;
    this.send.action = PlayerIdentifier.USER_DATA.displayName+"_"+team;

    //send update to all users in-scene
    PlayerIdentifier.MESSAGE_BUS.emit(key, this.send);
  }

  //unregisters any player from board's given team
  public UnregisterPlayer(team:number)
  {
    if(CheckerBoard.IsDebugging){ log("unregistering user "+PlayerIdentifier.USER_DATA.userId+" from checker board: "+this.index.toString()+"..."); }
    
    //create key and send data
    var key = "cb_rur_"+this.index.toString();
    
    //prepare the data capsule
    this.send.sender = PlayerIdentifier.USER_DATA.userId;
    this.send.action = "_"+team;

    //send update to all users in-scene
    PlayerIdentifier.MESSAGE_BUS.emit(key, this.send);
  }

  //user attempts to start board
  public StartBoard()
  {
    if(CheckerBoard.IsDebugging){ log("starting checker board: "+this.index.toString()+"..."); }
    
    //create key and send data
    var key = "cb_sbr_"+this.index.toString();
    
    //check if user is part of the board 
    if(this.registered_users_id[0] == PlayerIdentifier.USER_DATA.userId 
      || this.registered_users_id[1] == PlayerIdentifier.USER_DATA.userId)
    {
      //prepare the data capsule
      this.send.sender = PlayerIdentifier.USER_DATA.userId;
      this.send.action = "";

      //send update to all users in-scene
      PlayerIdentifier.MESSAGE_BUS.emit(key, this.send);
    }
  }

  //user attempts to restart board
  public RestartBoard()
  {
    if(CheckerBoard.IsDebugging){ log("restarting checker board: "+this.index.toString()+"..."); }
    
    //create key and send data
    var key = "cb_rbr_"+this.index.toString();
    
    //check if user is part of the board 
    if(this.registered_users_id[0] == PlayerIdentifier.USER_DATA.userId 
      || this.registered_users_id[1] == PlayerIdentifier.USER_DATA.userId)
    {
      //prepare the data capsule
      this.send.sender = PlayerIdentifier.USER_DATA.userId;
      this.send.action = "";

      //send update to all users in-scene
      PlayerIdentifier.MESSAGE_BUS.emit(key, this.send);
    }
  }
}

//used to apply a user's action across the network 
export type ActionCapsule =
{
  sender:string;
  action:string;
}

//used to apply a user's action across the network 
export type BoardCapsule =
{
  //user who is sending this information
  sender:string;
  //board's id
  id:number;
  //board's state serial (players/session state)
  serial_state:string;
  //board's marker location serial
  serial_markers_0:string;
  serial_markers_1:string;
}