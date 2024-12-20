// Import required modules
const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors'); // Import cors middleware\

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://sweetyandsavoryinc.github.io', 
}));

app.use(bodyParser.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post('/send-notification', async (req, res) => {
  const { fcmToken, title, body, imageUrl } = req.body;
  console.log(fcmToken)
  console.log(title)
  console.log(body)
  console.log(imageUrl)
  if (!fcmToken || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Create the notification payload
  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
      ...(imageUrl && { image: imageUrl }), // Include image if provided
    },
    data: {
      // Additional data can be added here
      customDataKey: 'customDataValue',
    },
  };

  try {
    // Send the notification
    setTimeout(async () => {
      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
    }, 2000);
    res.status(200).json({ message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

// New endpoint to get recipe details from a URL
app.post('/get-recipe', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  try {
    // Fetch the HTML content of the page
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Extract the required information
    const name = $("h1").text();
    const featuredIn = $("a.featured-category").text();
    const description = $("div.recipe-description").text();
    const prepTime = $("span.prep-time").text();
    const cookTime = $("span.cook-time").text();

    const ingredients = [];
    $("li.ingredient").each((i, elem) => {
      const amount = $(elem).find(".ingredient-amount").text();
      const item = $(elem).find(".ingredient-item").text();
      ingredients.push({ amount, item });
    });

    const instructions = [];
    $("li.instruction-step").each((i, elem) => {
      instructions.push($(elem).text());
    });

    const nutrition = {
      calories: $("span.nutrition-calories").text(),
      protein: $("span.nutrition-protein").text(),
      fat: $("span.nutrition-fat").text(),
      carbs: $("span.nutrition-carbs").text(),
    };

    const servings = $("span.servings").text();

    // Return the recipe information as a JSON response
    res.status(200).json({
      name,
      featuredIn,
      description,
      prepTime,
      cookTime,
      ingredients,
      instructions,
      nutrition,
      servings,
    });
  } catch (error) {
    console.error('Error scraping recipe:', error);
    res.status(500).json({ error: 'Failed to scrape recipe', details: error.message });
  }
});

app.post('/reset-password', async (req, res) => {
  const { email, token, password } = req.body;

  // Validate request data
  if (!email || !token || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Verify the reset token (for Firebase, you may need to use another verification method)
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.email !== email) {
      return res.status(400).json({ error: 'Invalid token for this email' });
    }

    // Update the user's password in Firebase
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password });

    // Respond with success
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

app.post('/confirm-email', async (req, res) => {
  const { token, email } = req.body;

  console.log('request token confirm email: ', token)

  if (!token) {
    return res.status(400).send('Invalid or missing token');
  }

  try {
    // Verify the token using Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email', // Type of OTP: 'signup' for email confirmation
    });

    console.log('response data: ', data)

    if (error) {
      console.error('Error confirming email:', error);
      return res.status(400).send('Invalid or expired token');
    }

    // If successful, return a success message
    res.status(200).send({success: 'Successfully confirmed email'});
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).send('An unexpected error occurred. Please try again later.');
  }
});
// Start the server
app.listen(PORT, () => {
  console.log(`Notification server is running on http://localhost:${PORT}`);
});
