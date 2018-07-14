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
  Dimensions,
  TouchableOpacity,
  TextInput
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import { stringToBytes } from 'convert-string';

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
      isWriteChar1: false,
      bleID: 'aaaa',
      countWrite: 0,
      textSend: '',
      isSending: false,
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
    //console.log('Received data from ' + data.peripheral + ' characteristic ' + data.characteristic, data.value);
    console.log('Received data from '+ data.value);

    BleManager.writeWithoutResponse(data.peripheral, 'fff0', 'fff1',[1])
    .then(() => {
    // Success code
      console.log('--Writed OK ');
    })
    .catch((error) => {
    // Failure code
      console.log('--Write failed ',error);
    });
    //---------------------------------
  }

  handleStopScan() {
    console.log('Scan is stopped');
    this.setState({ scanning: false });
  }

  startScan() {
    console.log('state scan',this.state.scanning);
    if (!this.state.scanning) {
      this.setState({peripherals: new Map()});
      BleManager.scan([], 3, true).then((results) => {
        console.log('Scanning...');
        this.setState({scanning:true});
      });
    }
  }
  retrieveConnected(){
    BleManager.getConnectedPeripherals([]).then((results) => {
      console.log(results);
      var peripherals = this.state.peripherals;
      for (var i = 0; i < results.length; i++) {
        var peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        this.setState({ peripherals });
      }
    });
  }
  handleDiscoverPeripheral(peripheral){
    var peripherals = this.state.peripherals;
    if (!peripherals.has(peripheral.id)){
      console.log('Got ble peripheral', peripheral);

      peripherals.set(peripheral.id, peripheral);
      this.setState({ peripherals })
    }
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

          this.setState({bleID:peripheral.id})
          console.log('Connected to ' + this.state.bleID);

          setTimeout(() => {
              BleManager.retrieveServices(peripheral.id).then((peripheralInfo) => {
                console.log('Peripheral info:',peripheralInfo);
                console.log('Peripheral characteristics:',peripheralInfo.characteristics[15].characteristic);
                var service = 'fff0';

              /*
                BleManager.startNotification(peripheral.id, service, 'fff4')
                .then(() => {
                  console.log('Started notification on ' + peripheral.id);

                  while (true) {
                    //console.log('-------while-----------')
                    BleManager.read(peripheral.id, service, 'fff2')
                    .then((dataRead) => {
                      console.log('----read data'+ dataRead);
                    })
                    .catch( (error) => {
                      console.log('----read failed'+error);
                    });
                  }
                }).catch((error) => {
                  console.log('Notification error', error);
                });
                */
            });
        }, 900);
        }).catch((error) => {
          console.log('Connection error', error);
        });
      }
    }
  }
  writeData() {
        this.setState({isSending: true})
        BleManager.writeWithoutResponse(this.state.bleID, 'fff0', 'fff3',[parseInt(this.state.textSend)])
        .then(() => {
          console.log('--Writed successfully: ',parseInt(this.state.textSend));
          this.setState({isSending: false})
        })
        .catch((error) => {
          console.log('--Write failed ',error);
        });
  }
  writeDataString() {
        const data = stringToBytes('F0F1F2F3F4F5FF');
        this.setState({isSending: true})
        BleManager.writeWithoutResponse(this.state.bleID, 'fff0', 'fff3',data)
        .then(() => {
          console.log('--writeDataString successfully: ',data);
          this.setState({isSending: false})
        })
        .catch((error) => {
          console.log('--writeDataString failed ',error);
        });
  }
  render() {
    const list = Array.from(this.state.peripherals.values());
    const dataSource = ds.cloneWithRows(list);

    return (
      <View style={styles.container}>
        <TouchableHighlight style={{alignItems: 'center',marginTop: 40,margin: 20, padding:20, backgroundColor:'#ccc'}} onPress={() => this.startScan() }>
          <Text>Scan Bluetooth ({this.state.scanning ? 'on' : 'off'})</Text>
        </TouchableHighlight>
        <View style={{alignItems: 'center',marginTop: 5,margin: 20, padding:20, backgroundColor:'#ccc'}}>
          <Text style= {{alignItems: 'center',fontSize: 20, color: 'green'}}> {this.state.bleID}</Text>
          <Text style= {{alignItems: 'center'}}> {this.state.isSending ? 'Sending data' + this.state.textSend : 'Send done.' + this.state.textSend }</Text>
        </View>
        <View style = {styles.inputWrite}>
          <TextInput
             style={{height: 40, flex: 1}}
             placeholder="data"
             keyboardType='numeric'
             onChangeText={(text) => this.setState({textSend: text})}
           />
           <TouchableOpacity style= {styles.button} onPress = { () => this.writeData() }>
               <Text> WRITE</Text>
           </TouchableOpacity>
           <TouchableOpacity style= {styles.button} onPress = { () => this.writeDataString() }>
               <Text> STR </Text>
           </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll}>
          {(list.length == 0) &&
            <View style={{flex:1, margin: 20}}>
              <Text style={{textAlign: 'center'}}>No peripherals</Text>
            </View>
          }
          <ListView
            enableEmptySections={true}
            dataSource={dataSource}
            renderRow={(item) => {
              const color = item.connected ? 'green' : '#fff';
              return (
                <View>
                  <TouchableHighlight onPress={() => this.test(item) }>
                    <View style={[styles.row, {backgroundColor: color}]}>
                      <Text style={{fontSize: 12, textAlign: 'center', color: '#333333', padding: 10}}>{item.name}</Text>
                      <Text style={{fontSize: 8, textAlign: 'center', color: '#333333', padding: 10}}>{item.id}</Text>
                    </View>
                  </TouchableHighlight>
                </View>
              );
            }}
          />
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    width: window.width,
    height: window.height
  },
  inputWrite: {
      height: 50,
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginLeft: 10,
      marginRight: 10,
      marginTop: 10,
  },
  btnWrite: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 10,
    marginRight: 10
  },
  button: {
      alignItems: 'center',
      backgroundColor: '#DDDDDD',
      padding: 10,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    margin: 10,
  },
  row: {
    margin: 10
  },
  textStyle: {
    color: 'black',
    flex: 1,
    textAlign: 'center',
  }
});
