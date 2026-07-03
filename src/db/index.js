import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async ()=>{
    try {
        //const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
    dbName: DB_NAME
      })
        console.log(`\n MongoDB connectes !! DB HOST:${connectionInstance.connection.host}`);//aapka jo pura mongodb ka url hai jahan pr connection ho raha hai vo le le taaki galti se mai khi aur production ki jagah galti se khin aur sever pr connect ho jaau kyunki database jo hai na vo producton ka alag hota hai development ka alag hota hai toh atleast meko pta ho ki mai onse host pr connect ho raha hu
        
    
    } catch (error) {
        console.error("ERROR",error)
        process.exit(1)
    }
}

export default connectDB