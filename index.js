const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kynyyka.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  // console.log(authHeader)

  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];


  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {

    if (err) {
      return res.status(403).send({ message: 'Forbidden Access' })
    }
    req.decoded = decoded;
    next();
  });
}
const auth = {
  auth: {
    api_key: 'key-1234123412341234',
    domain: 'one of your domain names listed at your https://app.mailgun.com/app/sending/domains'
  }
}


async function run() {

  try {
    await client.connect();
    const portalsCollection = client.db('hospital_doctor_portal').collection('portals');
    const bookingCollection = client.db('hospital_doctor_portal').collection('booking');
    const userCollection = client.db('hospital_doctor_portal').collection('user');
    const doctorsCollection = client.db('hospital_doctor_portal').collection('doctors');





    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });

      if (requesterAccount.role === 'admin') {

        next();

      }
      else {
        res.status(403).send({ message: 'forbiden' });

      }
    }





    app.get('/portals', async (req, res) => {
      const query = {};
      const cursor = portalsCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);
    });

    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();

      res.send(users);
    });
    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);

      res.send(result);





    });
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;

      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    });
    app.get('/doctor',verifyJWT,verifyAdmin,async(req,res)=>{
      const doctors = await doctorsCollection.find().toArray();
      res.send(doctors);

    })



    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;

      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
      res.send({ result, token });

    });
    //  Warning : 
    //  This is not the proper way to query
    // After learning more about mongodb. use aggregate lookup , pipeline, match,group
    app.get('/available', async (req, res) => {
      const date = req.query.date;


      // step -1: get all services
      const services = await portalsCollection.find().toArray();

      // step-2: get the booking of the day . output: [{},{}, {},{}]
      const query = { date: date };

      const booking = await bookingCollection.find(query).toArray();
      // step 3: for each service, find bookings for that service
      services.forEach(service => {
        // step 4 :find bookings for that services. output: [{},{}, {},{}]
        const serviceBooking = booking.filter(book => book.treatment === service.name);
        // step 5 : select slots for the service booking ['','','']
        const booked = serviceBooking.map(book => book.slot);
        // step 6 : select those slots that are not in bookedSlot
        const available = service.slots.filter(slot => !booked.includes(slot));
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
    app.get('/booking', verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      // console.log(patient)
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const booking = await bookingCollection.find(query).toArray();
        return res.send(booking);
      }
      else {
        return res.status(403).send({ message: 'forbidden access' });
      }




    });
    app.get('/booking/:id',verifyJWT, async(req,res)=>{
      const id = req.params.id;
    const query = {_id: ObjectId(id)};
    const booking = await bookingCollection.findOne(query);
    res.send(booking)
    })



    app.post('/booking', async (req, res) => {
      const booking = req.body;

      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
      const exixts = await bookingCollection.findOne(query);
      if (exixts) {
        return res.send({ success: false, booking: exixts })
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });


    });

    app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });
    app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter ={email: email};
      const result = await doctorsCollection.deleteOne(filter);
      res.send(result);
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






