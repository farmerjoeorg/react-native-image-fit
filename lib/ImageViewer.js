'use strict';

import React, { Component, PropTypes } from 'react';

import {
  StyleSheet,
  View,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
  Modal,
  InteractionManager
} from 'react-native';
import { backgroundValueCalculation } from './utils';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const { width, height } = Dimensions.get('window');

const LAYOUT_ENUM = {
  X: 'x',
  Y: 'y'
};

const BACKGROUND_VALUES = {
  MAX: 100,
  MIN: 0
};


export class ImageViewer extends Component {
  static propTypes = {
    // common
    source: Image.propTypes.source,
    disabled: PropTypes.bool,
    // main image 
    mainImageStyle: Image.propTypes.style,
    mainImageProps: PropTypes.arrayOf(PropTypes.object),
    // zoomed image
    zoomedImageStyle: Image.propTypes.style,
    zoomedImageProps: PropTypes.arrayOf(PropTypes.object),
    // callbacks
    onMove: PropTypes.func,
    onPress: PropTypes.func,
  };
  constructor(props, context) {
    super(props, context);
  
    this.state = {
      openModal: false,
      scale: new Animated.Value(1),
      layout: new Animated.ValueXY({ x: 0, y: 0 }),
      backgroundOpacity: new Animated.Value(BACKGROUND_VALUES.MIN),
      mainImageOpacity: new Animated.Value(1)
    };

    this.panResponder = null;
    this.layoutListener = null;
    this._layoutX = 0;
    this._layoutY = 0;
    this._imageSize = {
      width: null,
      height: null
    };

    this._modalClosing = false;
    this.handleMove = this.handleMove.bind(this);
    this.handleRelease = this.handleRelease.bind(this);
    this.toggleModal = this.toggleModal.bind(this);

    this.handleLayoutChange = this.handleLayoutChange.bind(this);
  }

  componentWillMount() {
    this.state.layout.x.addListener((animated) => this.handleLayoutChange(animated, LAYOUT_ENUM.X));
    this.state.layout.y.addListener((animated) => this.handleLayoutChange(animated, LAYOUT_ENUM.Y));

    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: this.handleMove,
      onPanResponderRelease: this.handleRelease,
      onPanResponderTerminate: this.handleRelease
    });

    Image.prefetch(this.props.source);

    Image.getSize(this.props.source, (width, height) => {
      this._imageSize = { width, height };
    });
  }
  componentWillUnmount() {
    this.state.layout.x.removeAllListeners();
    this.state.layout.y.removeAllListeners();
  }
  handleMove(e, gestureState) {
    if (typeof this.props.onMove === 'function') {
      this.props.onMove(e, gestureState);
    }
    Animated.event([null, {
      dx: this.state.layout.x,
      dy: this.state.layout.y
    }])(e, gestureState);
  }

  handleLayoutChange(animated, axis) {
    switch(axis) {
      case LAYOUT_ENUM.X:
        this._layoutX = animated.value;
        break;
      case LAYOUT_ENUM.Y:
        this._layoutY = animated.value;
        break;
    }

    if (this._modalClosing) {
      return;
    }

    const value = backgroundValueCalculation(this._layoutY, this._layoutX, BACKGROUND_VALUES);
    
    Animated.timing(this.state.backgroundOpacity, {
      toValue: value,
      duration: 1
    }).start();
  }

  handleRelease() {
    const value = backgroundValueCalculation(this._layoutY, this._layoutX, BACKGROUND_VALUES);
    const resetAnimation = Animated.timing(this.state.layout, {
      toValue: { x: 0, y: 0 },
      duration: 150
    });

    const resetBackgroundAnimation = Animated.timing(this.state.backgroundOpacity, {
      toValue: BACKGROUND_VALUES.MAX,
      duration: 150
    });

    const cleanBackgroundAnimation = Animated.sequence([
      Animated.timing(this.state.backgroundOpacity, {
        toValue: BACKGROUND_VALUES.MIN,
        duration: 150
      }),
      Animated.timing(this.state.mainImageOpacity, {
        toValue: 1,
        duration: 50
      })
    ]);

    const animations = [];
    animations.push(resetAnimation);
    
    const shouldCloseModal = value <= 0;
    
    if (shouldCloseModal){
      // close animation
      this._modalClosing = true;
      animations.push(cleanBackgroundAnimation);
    }

    animations.forEach(animation => animation.start());
    if (shouldCloseModal) {
      InteractionManager.runAfterInteractions(() => this.toggleModal());
    }
  }

  toggleModal() {
    const shouldOpen = !this.state.openModal;

    if (this.props.disabled) {
      return;
    }
    if (typeof this.props.onPress === 'function') {
      this.props.onPress(shouldOpen);
    }
    if (shouldOpen) {
      this._modalClosing = false;
      this.state.backgroundOpacity.setValue(BACKGROUND_VALUES.MAX);
    } else {
      this.state.backgroundOpacity.setValue(BACKGROUND_VALUES.MIN);
    }
    this.state.mainImageOpacity.setValue(shouldOpen ? 0 : 1);
    this.setState({
      openModal: shouldOpen
    });
  }

  render() {
    const {
      source,
      mainImageStyle,
      zoomedImageStyle,
    } = this.props;

    const {
      backgroundOpacity,
      openModal
    } = this.state;

    const fullImageStyle = {};

    if (this._imageSize.width / width > this._imageSize.height / height) {
      fullImageStyle.width = width;
      fullImageStyle.height = width / this._imageSize.width * this._imageSize.height
    } else {
      fullImageStyle.height = height;
      fullImageStyle.width = height / this._imageSize.width * this._imageSize.height;
    }

    const interpolatedColor = backgroundOpacity.interpolate({
      inputRange: [BACKGROUND_VALUES.MIN, BACKGROUND_VALUES.MAX],
      outputRange: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)']
    })

    return (
      <Animated.View>
        <TouchableWithoutFeedback
          onPress={this.toggleModal}
        >
          <AnimatedImage
            source={source}
            style={[
              styles.image,
              mainImageStyle,
              { opacity: this.state.mainImageOpacity }
            ]}
            resizeMode={'contain'}
          />
        </TouchableWithoutFeedback>
        <Modal
          animationType="fade"
          visible={openModal}
          onRequestClose={() => null}
          transparent={true}
        >
          <Animated.View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: interpolatedColor
            }}
          >
            <AnimatedImage
              source={source}
              {...this.panResponder.panHandlers}
              style={[
                fullImageStyle,
                zoomedImageStyle,
                { transform: this.state.layout.getTranslateTransform() }
              ]}
            />
          </Animated.View>
        </Modal>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width,
    height,
    bottom: 0,
  },
  image: {
    width: 200,
    height: 200,
  }
});