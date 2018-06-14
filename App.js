import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  TouchableHighlight,
  NativeAppEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
  ListView,
  ScrollView,
  AppState,
  TextInput
} from 'react-native';
import Dimensions from 'Dimensions';
import BleManager from 'react-native-ble-manager';
import TimerMixin from 'react-timer-mixin';
import reactMixin from 'react-mixin';
import { stringToBytes } from 'convert-string';
import { Col, Row, Grid } from "react-native-easy-grid";

const window = Dimensions.get('window');
const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default class App extends Component {
  constructor(){
    super()

    this.state = {
      scanning:false,
      peripherals: new Map(),
      appState: '',
      peripherial: {},
      foundHat: true,
      color: '#FF0000',
      customText:''
    }

    this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this);
    this.handleStopScan = this.handleStopScan.bind(this);
    this.handleUpdateValueForCharacteristic = this.handleUpdateValueForCharacteristic.bind(this);
    this.handleDisconnectedPeripheral = this.handleDisconnectedPeripheral.bind(this);
    this.handleAppStateChange = this.handleAppStateChange.bind(this);
  }

  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChange);

    BleManager.start({showAlert: false});

    this.handlerDiscover = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral );
    this.handlerStop = bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan );
    this.handlerDisconnect = bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', this.handleDisconnectedPeripheral );
    this.handlerUpdate = bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleUpdateValueForCharacteristic );



    if (Platform.OS === 'android' && Platform.Version >= 23) {
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
            if (result) {
              console.log("Permission is OK");
            } else {
              PermissionsAndroid.requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
                if (result) {
                  console.log("User accept");
                } else {
                  console.log("User refuse");
                }
              });
            }
      });
    }

  }

  handleAppStateChange(nextAppState) {
    if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!')
      BleManager.getConnectedPeripherals([]).then((peripheralsArray) => {
        console.log('Connected peripherals: ' + peripheralsArray.length);
      });
    }
    this.setState({appState: nextAppState});
  }

  componentWillUnmount() {
    this.handlerDiscover.remove();
    this.handlerStop.remove();
    this.handlerDisconnect.remove();
    this.handlerUpdate.remove();
  }

  handleDisconnectedPeripheral(data) {
    let peripherals = this.state.peripherals;
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      this.setState({peripherals});
    }
    console.log('Disconnected from ' + data.peripheral);
  }

  handleUpdateValueForCharacteristic(data) {
    console.log('Received data from ' + data.peripheral + ' characteristic ' + data.characteristic, data.value);
  }

  handleStopScan() {
    console.log('Scan is stopped');
    this.setState({ scanning: false });
  }

  startScan() {
    if (!this.state.scanning) {
      this.setState({peripherals: new Map()});
      BleManager.scan([], 3, true).then((results) => {
        console.log('Scanning...');
        this.setState({scanning:true});
      });
    }
  }

  retrieveConnected(){
    this.setState({foundHat:true});
    BleManager.getConnectedPeripherals([]).then((results) => {
      console.log(results);
      var peripherals = this.state.peripherals;
      var foundHat = false;
      for (var i = 0; i < results.length; i++) {
        var peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
      }
      this.setState({ peripherals, foundHat });

      // if(peripherial.id == 'DF7F0F14-D885-607B-1C90-598969A851A2'){
      //     tempPeripherial = peripherial;

      //     BleManager.connect(peripheral.id)
      //     .then(() => {
      //       let peripherals = this.state.peripherals;
      //       let p = peripherals.get(peripheral.id);
      //       if (p) {
      //         p.connected = true;
      //         peripherals.set(peripheral.id, p);
      //         this.setState({peripherals:peripherals, peripheral: p, foundHat:true});
      //       }
      //       console.log('Connected to ' + peripheral.id);
      //     })
      //   }
      //this.setState({ peripherals: peripherals, peripheral: tempPeripherial, foundHat: foundHat });
    });
  }

  handleDiscoverPeripheral(peripheral){
    var peripherals = this.state.peripherals;
    if (!peripherals.has(peripheral.id)){
      console.log('Got ble peripheral', peripheral);
      peripherals.set(peripheral.id, peripheral);

        if(peripheral.id == 'DF7F0F14-D885-607B-1C90-598969A851A2'){
          console.log('Dave');
          BleManager.connect(peripheral.id)
          .then(() => {
            let peripherals = this.state.peripherals;
            let p = peripherals.get(peripheral.id);
            if (p) {
              p.connected = true;
              peripherals.set(peripheral.id, p);
              this.setState({peripherals:peripherals, peripheralId: peripheral.id, foundHat:true});
            }
            console.log('Connected to ' + peripheral.id);
          })
        }

      this.setState({ peripherals })


    }
  }

  setColor(color){
    this.setState({color});
  }

  sendCustomText(){
    this.sendStringToHat(''); //Clear Text
    this.sendStringToHat('%3'); //Need to set low brightness for custom text to avoid crashes
    this.sendStringToHat(this.state.customText);
  }

  sendText(text, color, brightness){   
    if(!color) color = '#FF0000' //Default to Red
    if(!brightness) brightness = 3 //Default to relatively low as we don't want to crash           
    
    this.sendStringToHat(''); //Clear Text
    this.sendStringToHat('%' + brightness);
    this.sendStringToHat(color);
    this.sendStringToHat(text);
  }

  sendStringToHat(text){
    BleManager.retrieveServices(this.state.peripheralId).then((peripheralInfo) => {
      console.log(peripheralInfo);

      const data = stringToBytes(text);
      
      BleManager.writeWithoutResponse(this.state.peripheralId, '6E400001-B5A3-F393-E0A9-E50E24DCCA9E', '6E400002-B5A3-F393-E0A9-E50E24DCCA9E', data)
      .then(() => {
        // Success code
        console.log('Wrote: ' + data);
      })
      .catch((error) => {
        // Failure code
        console.log(error);
      });
    });
  }

  test(peripheral) {
    if (peripheral){
      if (peripheral.connected){
        BleManager.disconnect(peripheral.id);
      }else{
        BleManager.connect(peripheral.id).then(() => {
          let peripherals = this.state.peripherals;
          let p = peripherals.get(peripheral.id);
          if (p) {
            p.connected = true;
            peripherals.set(peripheral.id, p);
            this.setState({peripherals});
          }
          console.log('Connected to ' + peripheral.id);


          this.setTimeout(() => {

            /* Test read current RSSI value
            BleManager.retrieveServices(peripheral.id).then((peripheralData) => {
              console.log('Retrieved peripheral services', peripheralData);

              BleManager.readRSSI(peripheral.id).then((rssi) => {
                console.log('Retrieved actual RSSI value', rssi);
              });
            });*/


            BleManager.retrieveServices(peripheral.id).then((peripheralInfo) => {
              console.log(peripheralInfo);

              const data = stringToBytes('DAVE');
              
              BleManager.writeWithoutResponse(peripheral.id, '6E400001-B5A3-F393-E0A9-E50E24DCCA9E', '6E400002-B5A3-F393-E0A9-E50E24DCCA9E', data)
              .then(() => {
                // Success code
                console.log('Wrote: ' + data);
              })
              .catch((error) => {
                // Failure code
                console.log(error);
              });
            });

          }, 900);
        }).catch((error) => {
          console.log('Connection error', error);
        });
      }
    }
  }

  render() {
    const list = Array.from(this.state.peripherals.values());
    const dataSource = ds.cloneWithRows(list);


    return (
      <View style={styles.container}>
        {this.state.foundHat==true ? 
            <ScrollView>
              <TouchableHighlight style={styles.firstButton} >
                <Text style={styles.blackText}>{this.state.foundHat ? 'DISCONNECT' : 'CONNECT TO HAT'}</Text>
              </TouchableHighlight>

              <View
                style={{
                  borderBottomColor: '#696969',
                  borderBottomWidth: 2,
                  margin:10,
                  marginBottom:15
                }}
              />

              <TextInput
                style={styles.input}
                placeholder={'Enter Custom Text Here...'}
                maxLength={19}
                onChangeText={(customText) => this.setState({customText})}
                value={this.state.customText}
              />
              <Grid>
                    <Col style={{height:60}}>
                      <TouchableHighlight style={styles.redButton} onPress={() => this.setColor('#FF0000') }>
                        <Text style={styles.whiteText}>RED</Text>
                      </TouchableHighlight>
                    </Col>
                    <Col style={{height:60}}>
                      <TouchableHighlight style={styles.greenButton} onPress={() => this.setColor('#00FF00') }>
                        <Text style={styles.greenButtonText}>GREEN</Text>
                      </TouchableHighlight>
                    </Col>
                    <Col style={{height:60}}>
                      <TouchableHighlight style={styles.blueButton} onPress={() => this.setColor('#0000FF') }>
                        <Text style={styles.whiteText}>BLUE</Text>
                      </TouchableHighlight>
                    </Col>
              </Grid>

              <TouchableHighlight style={styles.customButton} onPress={() => this.sendCustomText() }>
                <Text style={styles.whiteText}>SEND CUSTOM TEXT</Text>
              </TouchableHighlight>

              <View
                style={{
                  borderBottomColor: '#696969',
                  borderBottomWidth: 2,
                  margin:10,
                  marginBottom:15
                }}
              />

              <TouchableHighlight style={styles.whiteButton} onPress={() => this.sendText('FISHERS!!!', '#FF0000', 4) }>
                <Text style={styles.redText}>FISHERS!!!</Text>
              </TouchableHighlight>
              
                <Grid>
                      <Col style={{height:60}}>
                        <TouchableHighlight style={styles.redButton} onPress={() => this.sendText('F', '#FFFFFF', 9) }>
                          <Text style={styles.whiteText}>F</Text>
                        </TouchableHighlight>
                      </Col>
                      <Col style={{height:60}}>
                        <TouchableHighlight style={styles.redButton} onPress={() => this.sendText('I', '#FFFFFF', 9) }>
                          <Text style={styles.whiteText}>I</Text>
                        </TouchableHighlight>
                      </Col>
                      <Col style={{height:60}}>
                        <TouchableHighlight style={styles.redButton} onPress={() => this.sendText('S', '#FFFFFF', 9) }>
                          <Text style={styles.whiteText}>S</Text>
                        </TouchableHighlight>
                      </Col>
                </Grid>
                <Grid>
                      <Col style={{height:60}}>
                        <TouchableHighlight style={styles.redButton} onPress={() => this.sendText('H', '#FFFFFF', 9) }>
                          <Text style={styles.whiteText}>H</Text>
                        </TouchableHighlight>
                      </Col>
                      <Col style={{height:60}}>
                        <TouchableHighlight style={styles.redButton} onPress={() => this.sendText('E', '#FFFFFF', 9) }>
                          <Text style={styles.whiteText}>E</Text>
                        </TouchableHighlight>
                      </Col>
                      <Col style={{height:60}}>
                        <TouchableHighlight style={styles.redButton} onPress={() => this.sendText('R', '#FFFFFF', 9) }>
                          <Text style={styles.whiteText}>R</Text>
                        </TouchableHighlight>
                      </Col>
                </Grid>
                <TouchableHighlight style={styles.whiteButton} onPress={() => this.sendText('@1', '#FF0000', 4) }>
                  <Text style={styles.redText}>SPARKLE</Text>
                </TouchableHighlight>
                <TouchableHighlight style={styles.whiteButton} onPress={() => this.sendText('@2', '#FF0000', 4) }>
                  <Text style={styles.redText}>RAINBOW SPARKLE</Text>
                </TouchableHighlight>
            </ScrollView>
          : 

            <TouchableHighlight style={{}} onPress={() => this.startScan() }>
              <Text>Find Hat ({this.state.scanning ? 'on' : 'off'})</Text>
            </TouchableHighlight>
        }
        
      </View>
    );
  }
}
reactMixin(App.prototype, TimerMixin);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    width: window.width,
    height: window.height
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    margin: 10,
  },
  row: {
    margin: 10
  },
  firstButton:{
    marginTop: 50,
    marginBottom: 10,
    margin: 5, 
    padding:15, 
    backgroundColor:'#ccc',
    borderRadius:10
  },
  input:{
    margin: 5, 
    padding:15, 
    backgroundColor:'#fff',
    borderRadius:10,
    borderWidth: 2,
    borderColor: '#ccc'
  },  
  customButton:{
    margin: 5, 
    marginBottom: 10,
    padding:15, 
    backgroundColor:'#696969',
    borderRadius:10
  },
  redButton:{
    margin: 5, 
    padding:15, 
    backgroundColor:'#f00',
    borderRadius:10
  },
  greenButton:{
    margin: 5, 
    padding:15, 
    backgroundColor:'#0f0',
    borderRadius:10
  },
  blueButton:{
    margin: 5, 
    padding:15, 
    backgroundColor:'#00f',
    borderRadius:10
  },
  whiteButton:{
    margin: 5, 
    padding:15, 
    backgroundColor:'#fff',
    borderRadius:10,
    borderWidth: 2,
    borderColor: '#f00'
  },
  whiteText:{
    color:'#fff',
    fontWeight:'bold',
    textAlign:'center',
    fontSize:18
  },
  greenButtonText:{
    color:'#696969',
    fontWeight:'bold',
    textAlign:'center',
    fontSize:18
  },
  redText:{
    color:'#f00',
    fontWeight:'bold',
    textAlign:'center',
    fontSize:18
  },
  blackText:{
    color:'#000',
    fontWeight:'bold',
    textAlign:'center',
    fontSize:18
  }
});