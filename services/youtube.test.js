// YEAH I KNOW THAT THIS FILE IS NOT WHAT TESTS USUALLY LOOK LIKE
const YoutubeService = require('./youtube');

const shouldReturnBroadcastsList = async () => {
  console.log(await YoutubeService.liveBroadcastsList());
};

const shouldInsertNewBroadcast = async () => {
  const { items: listBefore } = await YoutubeService.liveBroadcastsList();
  const newBroadcast = await YoutubeService.liveBroadcastsInsert();
  const { items: listAfter } = await YoutubeService.liveBroadcastsList();
  const isLengthIncreased = (listAfter.length - listBefore.length) === 1;
  console.log(isLengthIncreased ? 'Added new broadcast' : 'Error occured', newBroadcast);
};

// shouldReturnBroadcastsList();
// shouldInsertNewBroadcast();
