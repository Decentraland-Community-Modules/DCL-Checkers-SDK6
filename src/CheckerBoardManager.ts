/*    CHECKERS BOARD MANAGER
    controls the creation, registration, and removal
    of all game boards in the scene
*/
import { List, Dictionary } from "./dict";
import * as utils from '@dcl/ecs-scene-utils'
import { CheckerBoard, BoardCapsule } from "./CheckerBoard";
import { PlayerIdentifier } from "./PlayerIdentifier";
@Component("CheckerBoardManager")
export class CheckerBoardManager extends Entity
{
    initialized:boolean;
    //player ID
    playerID:PlayerIdentifier;

    //data exchange capsule
    send:SourceCapsule = { sender:"", source:"" };
    
    //used to display current session source
    ui_canvas:UICanvas = new UICanvas();
    rect:UIContainerRect = new UIContainerRect(this.ui_canvas);
    ui_text_user:UIText = new UIText(this.rect);
    ui_text_source:UIText = new UIText(this.rect);

    //returns the next available board index
    getNextIndex():number
    {
        var index:number = 0;
        while(this.checkerBoardDict.containsKey(index.toString()))
        {
            index++;
        }
        return index;
    }

    //collection of all active boards
    checkerBoardList:List<CheckerBoard> = new List<CheckerBoard>();
    checkerBoardDict:Dictionary<CheckerBoard> = new Dictionary<CheckerBoard>();
    //we also maintain a collection of board serial data on-hand
    checkerBoardSerialDict:Dictionary<BoardCapsule> = new Dictionary<BoardCapsule>();
    
    //used to initialize object
    constructor(id:PlayerIdentifier)
    {
        super();
        this.initialized = false;

        //assign player id
        this.playerID = id;

        //session source display
        //  rect container
        this.rect.positionX = 140;
        this.rect.positionY = 90;
        this.rect.hAlign = "left";
        this.rect.vAlign = "top";
        //  texts -- user
        this.ui_text_user.fontSize = 20;
        this.ui_text_source.positionY = 10;
        this.ui_text_user.width = "50%";
        this.ui_text_user.hAlign = "center";
        this.ui_text_user.vAlign = "top";
        //  texts -- source
        this.ui_text_source.value = "SOURCE ID: NULL";
        this.ui_text_source.fontSize = 20;
        this.ui_text_source.positionY = -20;
        this.ui_text_source.width = "50%";
        this.ui_text_source.hAlign = "center";
        this.ui_text_source.vAlign = "top";

        //add network processing for finding the trusted source, done at this level because it 
        //can result in a board sync
        //  received source sync demand
        //only the source will reply to this request
        PlayerIdentifier.MESSAGE_BUS.on
        (
            "get_source",
            (data : SourceCapsule) =>
            {
                //check if this user is the source
                if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
                {
                    if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE "
                    +PlayerIdentifier.USER_DATA.displayName+": user="+data.sender+" requested source, sending data"); }

                    //send source data
                    this.SendSourceData();
                }
                else
                {
                    if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE "
                    +PlayerIdentifier.USER_DATA.displayName+": user="+data.sender+" requested source, I am not source"); } 
                }
            }
        );
        //  received source id
        //all users process this command, setting the new session owner
        //and syncing boards as required
        PlayerIdentifier.MESSAGE_BUS.on
        (
            "sync_source",
            (data : SourceCapsule) =>
            {
                if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: user="
                +PlayerIdentifier.USER_DATA.userId+" received source="+data.source+", recording"); }
                
                //record source 
                PlayerIdentifier.TRUSTED_SOURCE = data.source;
                this.ui_text_source.value = "SESSION SOURCE:"+data.source;
                
                //if this user is the source begin sending out current board data
                if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
                {
                    if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: user="
                    +PlayerIdentifier.USER_DATA.userId+" is beginning sync across system"); }
                    
                    //process each available board, serializing and sending them across the network
                    for (let i = 0; i < this.checkerBoardList.size(); i++) 
                    { 
                        var index:number = this.checkerBoardList.get(i).Index();
                        //prepare capsule for sending
                        this.checkerBoardDict.getItem(index.toString()).SaveBoardToSerial(this.checkerBoardSerialDict.getItem(index.toString()));

                        
                        //send data
                        PlayerIdentifier.MESSAGE_BUS.emit("sync_board", this.checkerBoardSerialDict.getItem(index.toString()));
                    }
                }
                this.initialized = true;
            }
        );
        //  received board serial
        //all users except the  must abide this command, syncs all boards to the state of current host
        PlayerIdentifier.MESSAGE_BUS.on
        (
            "sync_board",
            (data : BoardCapsule) =>
            {//we only need to process inbound board data if we are not the trusted source
                if(PlayerIdentifier.USER_DATA.userId != PlayerIdentifier.TRUSTED_SOURCE 
                    && data.sender == PlayerIdentifier.TRUSTED_SOURCE
                )
                {
                    if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: user "
                    +PlayerIdentifier.USER_DATA.userId+" received a board serial, preparing a board from data"); }
                
                    //create a board based on this data
                    //  check if board of requested index exsists
                    if(!this.checkerBoardDict.containsKey(data.id.toString()))
                    {
                        //create a checker board for specific id
                        var board = new CheckerBoard(data.id);
                        board.setParent(this);
                
                        const dataCap:BoardCapsule = {sender:"", id:0, serial_state:"", serial_markers_0:"", serial_markers_1:"" };
                        //add board to collections
                        this.checkerBoardList.add(board);
                        this.checkerBoardDict.add(board.Index().toString(), board);
                        this.checkerBoardSerialDict.add(board.Index().toString(), dataCap);
                    }
                    //load board from serial data
                    this.checkerBoardDict.getItem(data.id.toString()).LoadBoardFromSerial(data);
                }
            }
        );
    }

    //initializes network and attempts syncing
    //  default setting is to attempt 3 connections with
    //each delayed 5 seconds after the previous attempt
    //its set up in this manner to give a connecting user
    //ample time to connect to the current source
    public NetworkSetup()
    {
        if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: starting network setup"); }
        this.initialized = false;
        //must be called here, because it requires playerID to be set
        this.ui_text_user.value = "USER ID: "+PlayerIdentifier.USER_DATA.userId;

        //process a delay and ensure the user recorded a source
        //  we randomize this to allow us to have variency while testing locally
        //  if we did not then both pages would connect at the same time
        var time = 5000 + Math.floor(Math.random() * 1000);
        utils.setTimeout(time, ()=>
        {
            if(!this.initialized && PlayerIdentifier.TRUSTED_SOURCE == undefined)
            {
                if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: network sync attempt 1..."); }
                //if there is no trusted source set, emit a sync request
                this.RequestSourceData(); 
            }
        });
        time += 5000;
        utils.setTimeout(time, ()=>
        {
            if(!this.initialized && PlayerIdentifier.TRUSTED_SOURCE == undefined)
            {
                if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: network sync attempt 2..."); }
                //if there is no trusted source set, emit a sync request
                this.RequestSourceData(); 
            }
        });
        time += 5000;
        utils.setTimeout(time, ()=>
        {
            if(!this.initialized && PlayerIdentifier.TRUSTED_SOURCE == undefined)
            {
                if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: network sync attempt 3..."); }
                //if there is no trusted source set, emit a sync request
                this.RequestSourceData(); 
            }
        });
        time += 5000;
        utils.setTimeout(time, ()=>
        {
            if(!this.initialized && PlayerIdentifier.TRUSTED_SOURCE == undefined)
            {
                if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: "+PlayerIdentifier.USER_DATA.displayName+" user="
                    +PlayerIdentifier.USER_DATA.userId+" is becoming the initial trusted source"); }

                //create and position a board from the manager
                var activeBoardIndex1 = this.CreateCheckerBoard();
                this.PositionCheckerBoard(activeBoardIndex1, 4, 1, 8);
    
                //set self as host for scene
                this.SendSourceData();
            }
        });

    }

    //makes a request to receive the trusted host of the scene
    public RequestSourceData()
    {
        if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS EMIT "+PlayerIdentifier.USER_DATA.displayName
        +": user="+PlayerIdentifier.USER_DATA.userId+" sending sync request"); }
        
        //update send capsule
        this.send.sender = PlayerIdentifier.USER_DATA.userId;
        this.send.source = "";

        //send data
        PlayerIdentifier.MESSAGE_BUS.emit("get_source", this.send);
    }

    //prepares and sends data to set this user as the trusted host to the scene
    public SendSourceData()
    {
        if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS EMIT "+PlayerIdentifier.USER_DATA.displayName
        +": user="+PlayerIdentifier.USER_DATA.userId+" sending source sync data"); }

        //update send capsule
        this.send.sender = PlayerIdentifier.USER_DATA.userId;
        this.send.source = PlayerIdentifier.USER_DATA.userId;

        //send data
        PlayerIdentifier.MESSAGE_BUS.emit("sync_source", this.send);
    }

    //creates and readies a board, returns its access index
    public CreateCheckerBoard():string
    {
        //create a checker board
        var board = new CheckerBoard(this.getNextIndex());
        board.setParent(this);

        const data:BoardCapsule = {sender:"", id:0, serial_state:"", serial_markers_0:"", serial_markers_1:"" };
        //add board to collections
        this.checkerBoardList.add(board);
        this.checkerBoardDict.add(board.Index().toString(), board);
        this.checkerBoardSerialDict.add(board.Index().toString(), data);

        return board.Index().toString();
    }

    //removes a board from the scene, completely dropping it from
    //  collections and engine
    public RemoveCheckerBoard(index:number)
    {
        //get board from collections
        var board = this.checkerBoardDict.getItem(index.toString());

        //remove board from engine
        board.setParent(null);

        //remove board from collections
        this.checkerBoardList.remove(board);
        this.checkerBoardDict.removeItem(index.toString());
        this.checkerBoardSerialDict.removeItem(index.toString());
    }

    //sets the position of a given board
    public PositionCheckerBoard(index:string, x:number, y:number, z:number)
    {
        //position board
        this.checkerBoardDict.getItem(index).SetPosition(x,y,z);
    }
}

//stores details for this scene's source
export type SourceCapsule =
{
  sender:string;
  source:string;
}