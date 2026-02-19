const SlideshowService = require('../../src/services/slideshowService');
const Logger = require('../../src/utils/logger');

// Initialize Logger singleton before tests
Logger.resetInstance();
Logger.getInstance('ERROR'); // suppress logs during tests

const baseConfig = {
  logLevel: 'ERROR',
  defaults: {
    interval: 5000,
    filter: 'none',
    transition: 'none',
    transitionDuration: 1000,
    showWatermark: false,
    watermarkText: 'Test',
    watermarkType: 'text',
    watermarkImage: '',
    watermarkPosition: 'bottom-right',
    watermarkSize: 'medium',
    watermarkOpacity: 80,
    shuffleImages: false,
    repeatLatest: false,
    latestCount: 5,
    transparentBackground: false,
    excludedImages: [],
    language: 'en',
    recursiveSearch: false,
  },
  photosPath: './photos',
};

function createImages(count) {
  return Array.from({ length: count }, (_, i) => ({
    filename: `img_${i + 1}.jpg`,
    path: `/photos/img_${i + 1}.jpg`,
    size: 1000,
    created: new Date(2025, 0, i + 1),
    modified: new Date(2025, 0, i + 1),
    photoDate: new Date(2025, 0, i + 1),
    isNew: false,
    thumbnail: null,
    orientation: 1,
  }));
}

describe('SlideshowService', () => {
  let service;
  let emittedEvents;

  beforeEach(() => {
    service = new SlideshowService(baseConfig);
    emittedEvents = [];
    service.setEventEmitter((event, data) => {
      emittedEvents.push({ event, data });
    });
  });

  afterEach(() => {
    service.stopSlideshowTimer();
    service.stopQueueProcessing();
  });

  describe('updateImages', () => {
    test('stores images and updates state', () => {
      const images = createImages(3);
      service.updateImages(images);
      expect(service.getCurrentImages()).toHaveLength(3);
    });

    test('sets currentImage to first when images are loaded', () => {
      service.updateImages(createImages(3));
      expect(service.getState().currentImage.filename).toBe('img_1.jpg');
    });

    test('handles empty list', () => {
      service.updateImages([]);
      expect(service.getState().currentImage).toBeNull();
    });
  });

  describe('changeImage', () => {
    test('advances to next image', () => {
      service.updateImages(createImages(3));
      emittedEvents = [];
      service.changeImage(1);
      expect(service.getState().currentImage.filename).toBe('img_2.jpg');
    });

    test('wraps around at the end', () => {
      service.updateImages(createImages(3));
      service.changeImage(1); // -> 2
      service.changeImage(1); // -> 3
      service.changeImage(1); // -> back to 1
      expect(service.getState().currentImage.filename).toBe('img_1.jpg');
    });

    test('wraps around backwards', () => {
      service.updateImages(createImages(3));
      service.changeImage(-1); // -> 3
      expect(service.getState().currentImage.filename).toBe('img_3.jpg');
    });

    test('emits image-changed event', () => {
      service.updateImages(createImages(3));
      emittedEvents = [];
      service.changeImage(1);
      const changed = emittedEvents.find(e => e.event === 'image-changed');
      expect(changed).toBeDefined();
      expect(changed.data.currentImage.filename).toBe('img_2.jpg');
    });

    test('does nothing when list is empty', () => {
      service.updateImages([]);
      emittedEvents = [];
      service.changeImage(1);
      expect(emittedEvents.filter(e => e.event === 'image-changed')).toHaveLength(0);
    });
  });

  describe('jumpToImage', () => {
    test('jumps to specified index', () => {
      service.updateImages(createImages(5));
      service.jumpToImage(3);
      expect(service.getState().currentImage.filename).toBe('img_4.jpg');
    });

    test('ignores out-of-bounds index', () => {
      service.updateImages(createImages(3));
      service.jumpToImage(10);
      expect(service.getState().currentImage.filename).toBe('img_1.jpg');
    });
  });

  describe('pause / resume', () => {
    test('pause sets isPlaying to false', () => {
      service.updateImages(createImages(3));
      service.pause();
      expect(service.getState().isPlaying).toBe(false);
    });

    test('resume sets isPlaying to true', () => {
      service.updateImages(createImages(3));
      service.pause();
      service.resume();
      expect(service.getState().isPlaying).toBe(true);
    });
  });

  describe('updateSettings', () => {
    test('merges new settings', () => {
      service.updateSettings({ interval: 10000, filter: 'sepia' });
      const settings = service.getSettings();
      expect(settings.interval).toBe(10000);
      expect(settings.filter).toBe('sepia');
    });

    test('toggling shuffle preserves current image', () => {
      const images = createImages(5);
      service.updateImages(images);
      service.jumpToImage(2); // img_3
      service.updateSettings({ shuffleImages: true });
      // Current image should still be img_3
      expect(service.getState().currentImage.filename).toBe('img_3.jpg');
    });
  });

  describe('toggleImageExclusion', () => {
    test('excludes an image', () => {
      service.updateImages(createImages(3));
      service.toggleImageExclusion('img_2.jpg');
      expect(service.getSettings().excludedImages).toContain('img_2.jpg');
    });

    test('re-includes a previously excluded image', () => {
      service.updateImages(createImages(3));
      service.toggleImageExclusion('img_2.jpg');
      service.toggleImageExclusion('img_2.jpg');
      expect(service.getSettings().excludedImages).not.toContain('img_2.jpg');
    });

    test('excluded images are filtered from current list', () => {
      service.updateImages(createImages(3));
      service.toggleImageExclusion('img_2.jpg');
      const list = service.getCurrentImagesList();
      expect(list.find(i => i.filename === 'img_2.jpg')).toBeUndefined();
      expect(list).toHaveLength(2);
    });
  });

  describe('timer', () => {
    jest.useFakeTimers();

    test('auto-advances after interval', () => {
      service.updateImages(createImages(3));
      service.startSlideshowTimer();
      jest.advanceTimersByTime(5000);
      expect(service.getState().currentImage.filename).toBe('img_2.jpg');
      service.stopSlideshowTimer();
    });

    test('does not advance when paused', () => {
      service.updateImages(createImages(3));
      service.pause();
      service.startSlideshowTimer();
      jest.advanceTimersByTime(10000);
      expect(service.getState().currentImage.filename).toBe('img_1.jpg');
      service.stopSlideshowTimer();
    });

    afterAll(() => jest.useRealTimers());
  });

  describe('queue system', () => {
    test('addImageToQueue adds to queue', () => {
      service.updateImages(createImages(3));
      service.addImageToQueue('img_2.jpg');
      expect(service.newImageQueue).toContain('img_2.jpg');
    });

    test('stopQueueProcessing clears the queue', () => {
      service.addImageToQueue('img_1.jpg');
      service.addImageToQueue('img_2.jpg');
      service.stopQueueProcessing();
      expect(service.newImageQueue).toHaveLength(0);
      expect(service.isProcessingQueue).toBe(false);
    });
  });
});
