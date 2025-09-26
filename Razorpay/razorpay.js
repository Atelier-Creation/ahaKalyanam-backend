// Express route to create a Razorpay order
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: "rzp_live_RM7S1lB5Kj6IQv",
  key_secret: "va85c9wWgBo26unuEHuB8zdm",
});

app.post("/createorder", async (req, res) => {
  const options = {
    amount: 100000, // 1000 INR in paise
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
