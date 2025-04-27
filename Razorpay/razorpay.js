// Express route to create a Razorpay order
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: "rzp_test_FaDMhj1BABXeNp",
  key_secret: "WSfCaTByiOPQYfMwn2zNszaA",
});

app.post("/create-order", async (req, res) => {
  const options = {
    amount: 50000, // 500 INR in paise
    currency: "INR",
    receipt: "order_rcptid_11",
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to create Razorpay order");
  }
});
