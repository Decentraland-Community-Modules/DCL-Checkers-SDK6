/*      MENU BUILDER
    used to create and manage a 3d menu in your
    game scene. you can create and organize individual
    menu pieces through an instance of this module, 
    but you need to assign interactions in your own script.
*/
import { List, Dictionary } from "./dict";
@Component("MenuBuilder")
export class MenuBuilder extends Entity 
{
    //address to target models
    private object_locations:string[] = 
        ["models/MenuObj_Short.glb","models/MenuObj_Medium.glb","models/MenuObj_Long.glb"];

    //collections for entity access
    private menuList:List<MenuObject>;
    private menuDict:Dictionary<MenuObject>;

    constructor()
    {
        super();

        //add transform
        this.addComponent(new Transform
          ({
            position: new Vector3(0,0,0),
            scale: new Vector3(1,1,1),
            rotation: new Quaternion().setEuler(0,0,0)
          }));

        //initialize collections
        this.menuList = new List<MenuObject>();
        this.menuDict = new Dictionary<MenuObject>();
    }

    //prepares a menu object of the given size/shape, with the given text, 
    //  registered under the given name
    public AddMenu(size:number, name:string, text:string)
    {
        //create and prepare entities
        var tmp:MenuObject = new MenuObject(this.object_locations[size], name, text)
        tmp.setParent(this);

        //register object to collections
        this.menuList.add(tmp);
        this.menuDict.add(name, tmp);
    }

    //returns the requested menu object
    public GetMenu(name:string):MenuObject
    {
        return this.menuDict.getItem(name);
    }

    //repositions a menu object, relative to its parent
    public SetMenuPosition(name:string, vect:Vector3)
    {
        this.menuDict.getItem(name).getComponent(Transform).position = vect;
    }

    //rescales a menu object, relative to its parent
    public SetMenuScale(name:string, vect:Vector3)
    {
        this.menuDict.getItem(name).getComponent(Transform).scale = vect;
    }

    //rescales a menu object, relative to its parent
    public SetMenuRotation(name:string, vect:Vector3)
    {
        this.menuDict.getItem(name).getComponent(Transform).rotation = new Quaternion(vect.x, vect.y, vect.z);
    }

    //sets a menu's text
    public SetMenuText(name:string, text:string)
    {
        this.menuDict.getItem(name).Text.value = text;
    }
}

@Component("MenuObject")
export class MenuObject extends Entity 
{
    public Name:string;
    public Text:TextShape;

    constructor(model:string, nam:string, text:string)
    {
        super();

        this.Name = nam;

        this.addComponent(new Transform
            ({
              position: new Vector3(0,0,0),
              scale: new Vector3(1,1,1),
              rotation: new Quaternion().setEuler(0,0,0)
            }));
        this.addComponent(new GLTFShape(model));

        //prepare text object
        var textObj = new Entity();
        textObj.setParent(this);
        this.Text = textObj.addComponent(new TextShape(text));

    }
}