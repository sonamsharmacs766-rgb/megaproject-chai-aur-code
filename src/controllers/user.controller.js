import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { json } from "express";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAcessandRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})
        return { accessToken,refreshToken }

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token");
        
    }
}
const registerUser = asynchandler( async (req,res)=>{
    
    //get user details from frontend
    const {fullname,email,username,password} = req.body
    console.log("username:",username);

    //validation every field
    if (
        [fullname,email,username,password].some((field)=>
        field?.trim()==="")
        
    ) {
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })
    if (existedUser) {
        throw new ApiError(409,"User with this username or email already exists");
        
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverimageLocalPath = req.files?.coverimage[0]?.path; -- iski wajah se undefined error aa raha tha agar humne isko nhi bheja toh
    let coverimageLocalPath;
    if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length>0){
        coverimageLocalPath = req.files.coverimage[0].path
    }

     if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
        
     }

     const avatar = await uploadOnCloudinary(avatarLocalPath)
     const coverimage = await uploadOnCloudinary(coverimageLocalPath)

     if(!avatar){
         throw new ApiError(400,"Avatar file is required");
     }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverimage:coverimage?.url || "",
        email,
        password,
        username:username.toLowerCase()
     })

     const createduser = await User.findById(user._id).select(
        "-password -refreshToken"
     )

     if(!createduser){
        throw new ApiError(500,"Something went wrong while registering the user");
        
     }

     return res.status(201).json(
        new ApiResponse(200,createduser,"User Registered Successfully")
     )

})


const loginUser = asynchandler(async (req,res)=>{
    //req.body -> data
    //username or email--kisi ek pr login karayenge
    //find the user
    //password check
    //access and refresh token
    //send cookie

    const {email,username,password} = req.body;

    if(!(username || email)){
        throw new ApiError(400,"Username and email is required")
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    const ispasswordvalid = await user.isPasswordCorrect(password)
     if(!ispasswordvalid){
        throw new ApiError(401,"invalid user credentials")
    }
    const {accessToken,refreshToken} = await generateAcessandRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
          new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User logged in successfully"
          )
    )
})

const logoutUser = asynchandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                 refreshToken:1//undefined se nhi hoga //this removes the field from this document
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
          new ApiResponse(
            200,
            {},
            "User logged out successfully"
          )
    )

})


const refreshAccessToken = asynchandler(async (req,res) =>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }

    try {
        const decodedtoken = jwt.verify(
            incomingRefreshToken,
            process.env.REFERSH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }
    
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"Refresh Token is expird or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken,newrefreshToken} = await generateAcessandRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newrefreshToken,options)
        .json(
              new ApiResponse(
                200,
                {
                    accessToken,newrefreshToken
                },
                "Access Token Refreshed"
              )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asynchandler(async(req,res)=>{
    const {oldPassword,newPassword,confPassword} = req.body

    if(!(newPassword === confPassword)){
        throw new ApiError(400,"Invalid new password");
    }

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password"); 
    }

    user.password = newPassword 
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

//curresnt user hona chaiye aapke paas
const getCurrentUser = asynchandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")//kyunki aapki request pr middleware run ho chuka hai
})

//agar baaki details update krni ho password toh ek alag page hota hai toh as a backend developer aapko sochna padega
const updateAccountDetails = asynchandler(async(req,res)=>{
    const {fullname,email} = req.body

    if(!fullname || !email){
        throw new ApiError(400,"All fields are required"); 
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {new:true}//update hone ke baad jo information hai vo aapko return hoti hai
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

//files ko update krna
const updateUserAvatar = asynchandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

     if(!avatar.url){
        throw new ApiError(400,"Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,

        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "avatar image updated successfully")
    )
})

const updateUserCoverimage = asynchandler(async(req,res)=>{
    const coverimageLocalPath = req.file?.path

    if(!coverimageLocalPath){
        throw new ApiError(400,"Cover image file is missing")
    }

    const coverimage = await uploadOnCloudinary(coverimageLocalPath)

     if(!coverimage.url){
        throw new ApiError(400,"Error while uploading coverimage")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,

        {
            $set:{
                coverimage:coverimage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "cover image updated successfully")
    )
})
// user se connect kr rahe hum
const getUserChannelProfile = asynchandler(async(req,res)=>{
        const {username} = req.params//its like url se username lena

        if(!username?.trim()){
            throw new ApiError(400,"user name is missing")
        }

        //User.find({username})--aise bhi kr sakte hai ki user find kr le query daalkr but instead we will use match function of aggregate
        const channel = await User.aggregate([
            {
                $match:{
                    usernmae:username?.toLowerCase()//ab suppose ek user aa gaya hai like chai aur code ab uske subscribers kitne hai vo find karenge
                }
            },
            //ab find kr rahe chai aur code ke subscribers kitne hai
            {
                $lookup:{//iss pipeline ke andar saare documents ko ikhata kr ke rakh liya
                    from:"subscriptions",//model mai lower case mai ho jaati aur plural ho jaati
                    localField:"_id",
                    foreignField:"channel",
                    as:"subscribers"//channels ko saare select krke i got my subscribers 
                }
            },
            //ab maine kitno ko subscribe kr rakha hai
            {
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"subscriber",
                    as:"subscribedTo"//maine kisko subscribe kr rakha hai
                }
            },
            //additional fiels add karna
            {
                $addFields:{
                    subscribersCount:{
                         $size: "$subscribers"
                    },
                    channesSubscribedToCount:{
                        $size: "$subscribedTo"
                    },
                    //for the button ki subscribe show krna hai ya subscribed
                    isSubscribed:{
                         $cond:{
                            if:{$in: [req.user?._id, "$subscribers.subscriber"]},//in means present hai ki nhi
                            then: true,
                            else: false
                         }
                    }
                }
            },
            //Final challenge-project--projection deta hai ki mai saari cheezo ko project nhi karunga mai selected dunga toh jo values mujhe deni hai unka flag on kr denge i.e 1 likh denge 
            {
                $project:{
                    fullname: 1,
                    username: 1,
                    subscribersCount: 1,
                    channesSubscribedToCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverimage: 1,
                    email: 1
                }

            }
        ])

        console.log(channel) //aggregate array return krta hai

        if(!channel?.length){
            throw new ApiError(404,"channel does not exist")
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched successfully")
        )
        
})

//watch history--idhar nested lookup krna padega because watch history se aapko videos ke saare documents mil jaayenge but videos ke andar ek owner bhi hai uski details bhi hume chaiye hongi
const getWatchedhistory = asynchandler(async(req,res)=>{
      const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{//bahut saare videos ke documents iske andar aa gye hai
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchedHistory",
                pipeline: [
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",//-19:20 timestamp
                            as: "owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    //ye pipeline sirf frontend ko data ache se mile sirf isliye
                    {
                        $addFields:{
                              owner:{
                                $first:"$owner"
                              }
                        }
                    }
                ]
            }
        }
      ])

      return res
      .status(200)
      .json(
        new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully")
      )
})


export{
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverimage,
    getUserChannelProfile ,
    getWatchedhistory
}