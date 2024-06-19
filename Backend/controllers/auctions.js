import express from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const response = await axios.get('http://uptime-auction-api.azurewebsites.net/api/Auction');
    const auctions = response.data;
    res.json(auctions);
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bid', async (req, res) => {
  try {
    console.log('Received bid request:', req.body);

    const {
      productId,
      bidTime,
      bid_amount,
      user_id,
      productName,
      productDescription,
      productCategory,
      biddingEndDate
    } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        id: user_id
      }
    });

    if (!user) {
      console.error('User not found with id:', user_id);
      res.status(400).json({ error: 'User not found' });
      return;
    }

    let auctionItem = await prisma.auctionItem.findUnique({
      where: {
        id: productId
      }
    });

    if (!auctionItem) {
      console.log('Creating new bid');
      auctionItem = await prisma.auctionItem.create({
        data: {
          id: productId,
          productId: productId,
          productName: productName,
          productDescription: productDescription,
          productCategory: productCategory,
          biddingEndDate: new Date(biddingEndDate),
          bid_time: bidTime,
          bid_amount: bid_amount,
          user_id: user_id
        }
      });
    } else {
      const highestBid = await prisma.auctionItemBidAmount.findFirst({
        where: {
          auctionItem_id: productId,
          NOT: {
            user_id: user_id
          }
        },
        orderBy: {
          bid_amount: 'desc'
        }
      });

      if (!highestBid || bid_amount > highestBid.bid_amount) {
        await prisma.auctionItem.update({
          where: { id: productId },
          data: {
            bid_time: bidTime,
            bid_amount: bid_amount,
            user_id: user_id
          }
        });
      }
    }

    const existingBid = await prisma.auctionItemBidAmount.findFirst({
      where: {
        auctionItem_id: productId,
        user_id: user_id
      }
    });

    if (existingBid) {
      console.log('Updating existing bidamount');
      const updatedBid = await prisma.auctionItemBidAmount.update({
        where: {
          id: existingBid.id
        },
        data: {
          bid_amount: bid_amount
        }
      });
      console.log('Bidamount updated successfully');
      res.json({ message: 'Bid updated successfully', bid: updatedBid });
    } else {
      console.log('Creating new bidamount');
      const newBid = await prisma.auctionItemBidAmount.create({
        data: {
          bid_amount: bid_amount,
          AuctionItem: {
            connect: { id: productId },
          },
          User: {
            connect: { id: user_id }
          }
        }
      });
      console.log('New bidamount created successfully');
      res.json({ message: 'Bid saved successfully', bid: newBid, fullName: user.fullname });
    }

  } catch (error) {
    console.error('Error saving bid:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/removeBid', async (req, res) => {
  try {
    console.log('Received bid removal request:', req.body);

    const { productId, user_id } = req.body;

    const existingBid = await prisma.auctionItemBidAmount.findFirst({
      where: {
        auctionItem_id: productId,
        user_id: user_id
      }
    });

    if (!existingBid) {
      console.log('No existing bid found for removal');
      return res.status(404).json({ error: 'No existing bid found for removal' });
    }

    await prisma.auctionItemBidAmount.delete({
      where: {
        id: existingBid.id
      }
    });

    const otherBids = await prisma.auctionItemBidAmount.findMany({
      where: {
        auctionItem_id: productId,
        NOT: {
          user_id: user_id
        }
      }
    });

    if (otherBids.length === 0) {
      await prisma.auctionItem.delete({
        where: {
          id: productId
        }
      });
    }

    res.json({ message: 'Bid removed successfully' });

  } catch (error) {
    console.error('Error removing bid:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/userAuctions', async (req, res) => {
  try {
    const { userId } = req.query;
    const userAuctions = await prisma.auctionItem.findMany({
      where: {
        user_id: parseInt(userId),
      },
      include: {
        AuctionItemBidAmount: true,
      },
    });
    res.json(userAuctions);
  } catch (error) {
    console.error('Error fetching user auctions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const auctionsController = router;