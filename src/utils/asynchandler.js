const asynchandler = (requesthandler)=>{
    return (req,res,next)=>{
        Promise.resolve(requesthandler(req,res,next)).catch((err)=>next(err))
}//this is through promise most common used and a good practice
}




export {asynchandler}




/*const asynchandler = (func)=>async(res,req,next)=>{
    try {
        await func(res,req,next)
    } catch (err) {
        res.status(err.code || 500).json({
            success:false,
            message:err.message
        })
    }
}
    *///this is a not so use practice for asynchandler through try and catch