import mongoose,{ Schema } from "mongoose";

const subscriptionschema = new Schema(
    {
       subscriber:{
        type:Schema.Types.ObjectId,//one who is subscribing--subscribe jo maine kiye
        ref:"User"
       },
       channel:{
        type:Schema.Types.ObjectId,//one to whom subscriber is subscribing--mere subscribers
        ref:"User"
       }
    },
    {timestamps:true}
)


export const Subscription = mongoose.model("Subscription",subscriptionschema)