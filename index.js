const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kynyyka.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run(){

  try {
    await client.connect();
   const portalsCollection = client.db('hospital_doctor_portal').collection('portals');
   const bookingCollection = client.db('hospital_doctor_portal').collection('booking');
   const userCollection = client.db('hospital_doctor_portal').collection('users');











   app.get('/portals',async(req, res) =>{
    const query = {};
    const cursor = portalsCollection.find(query);
    const services = await cursor.toArray();
    res.send(services);
   });
   app.put('/user/:email',async(req,res)=>{
    const email = req.params.email;
    const user = req.body;

    const option = {email:email};
    const options = { upsert: true};
    const updateDoc = {
      $set:user,
    };
    const result = await userCollection.updateOne(filter, updateDoc,options);
    res.send(result);

   })
  //  Warning : 
  //  This is not the proper way to query
  // After learning more about mongodb. use aggregate lookup , pipeline, match,group
   app.get('/available',async(req,res)=>{
    const date = req.query.date ;


    // step -1: get all services
    const services =  await portalsCollection.find().toArray();
   
    // step-2: get the booking of the day . output: [{},{}, {},{}]
    const query = {date: date};
    const booking = await bookingCollection.find(query).toArray();
    // step 3: for each service, find bookings for that service
    services.forEach(service =>{
      // step 4 :find bookings for that services. output: [{},{}, {},{}]
      const serviceBooking = booking.filter(book => book.treatment === service.name);
      // step 5 : select slots for the service booking ['','','']
      const booked = serviceBooking.map(book => book.slot);
      // step 6 : select those slots that are not in bookedSlot
      const available = service.slots.filter(slot=>!booked.includes(slot));
      // step 7 : set available to slots to make it easier
      service.slots = available;
      // service.booked = booked
      // service.booked = serviceBooking.map(s=> s.slot);
    })


   
    res.send(services);
    
    


   })
   
   //    /**
//  *  API  naming Convention
//   *app.get('/booking')>>>get all booking in this collection.or get more then one or by filter
//  *app.get('/booking')>>>get a specific boiking
//  *app.post('/booking')>>>> add a new booking
//  *app.patch('/booking/:id)>>
// *app.put('booking/:id)//upsert ==> update(if exists) or insert (if doesn't exists)
//  *app.delete('/booking/:id')
// * / 
app.get('/booking',async(req,res)=>{
  const patient = req.query.patient;
  const query = {patient: patient};
    const booking = await bookingCollection.find(query).toArray();
    res.send(booking)

})



app.post('/booking', async(req, res)=>{
const booking = req.body;
const query = {treatment: booking.treatment, date:booking.date, patient: booking.patient}
const exixts = await bookingCollection.findOne(query);
if(exixts){
  return res.send({success:false, booking: exixts})
}
const result =await bookingCollection.insertOne(booking);
 return res.send({ success:true, result});


});

   
  }
  finally {

  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello From Doctors')
})

app.listen(port, () => {
  console.log(`Doctors app listening on port ${port}`)
})






