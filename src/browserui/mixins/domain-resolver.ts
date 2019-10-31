
import axios from 'axios';
import { BrowserSettings, IPFSContentMethod, DomainResolutionMethod } from '~/browserui/models/browser-settings';
import { Namicorn } from 'namicorn';
const isIPFS = require('is-ipfs')

let _namicornInst:Namicorn = undefined;

const getNamicorn = () => {
  if(_namicornInst){
    return _namicornInst;
  }else{
    _namicornInst = new Namicorn();
    return _namicornInst;
  }
}


export class DomainResolver {
  private CLOUDFLARE_CDN_BASE: string = 'https://cloudflare-ipfs.com/ipfs/';
  private INFURA_CDN_BASE: string = 'https://ipfs.infura.io/ipfs/';

  private browserSettings: BrowserSettings;

  constructor(browserSettings: BrowserSettings) {
    this.browserSettings = browserSettings;
  }

  public resolve(url: string) {
    return new Promise((resolve, reject) => {
      let destUrl: string = undefined;
      let showUrl: string = undefined;

      if (!url.includes('.')) {
        url = "https://www.google.com/search?q=" + url;
      } else if (!/^https?:\/\//i.test(url)) {
        url = url.replace('ipfs://', '');
        url = 'http://' + url + "/";
      }

      let hostnameParts = new URL(url).hostname.split('.');
      let extension = hostnameParts[hostnameParts.length - 1];
      let domain = hostnameParts[hostnameParts.length - 2];

      if (extension == 'zil') {
        showUrl = url;

        switch (this.browserSettings.domainResolutionMethod) {
          case DomainResolutionMethod.UnstoppableAPI:
            console.log("Resolving via unstoppable API");
            this.resolveZilUnstoppableAPI(domain).then((zilResult) => {
              if (zilResult) {
                showUrl = url.replace('http://', 'ipfs://');
                destUrl = this.cdnBaseUrl + zilResult + "/";
                resolve({ url: showUrl, dest: destUrl, type: 'zil', ipfsHash: zilResult });
              }
            }).catch((err) => {
              if(err.response == 500){
                reject(err);
              }else{
                destUrl = "https://unstoppabledomains.com/search?searchTerm=" + domain + "&searchRef=home";
                resolve({ url: undefined, dest: destUrl, type: 'http' });
              }
            });
            break;
          case DomainResolutionMethod.ZilliqaApi:
            console.log("Resolving via Zilliqa API");
            this.resolveZilZilAPI(domain).then((zilResult) => {
              if (zilResult) {
                showUrl = url.replace('http://', 'ipfs://');
                destUrl = this.cdnBaseUrl + zilResult + "/";
                resolve({ url: showUrl, dest: destUrl, type: 'zil', ipfsHash: zilResult });
              }
            }).catch((err) => {
              if(err.response == 500){
                reject(err);
              }else{
                destUrl = "https://unstoppabledomains.com/search?searchTerm=" + domain + "&searchRef=home";
                resolve({ url: undefined, dest: destUrl, type: 'http' });
              }
            });
            break;
        }
      } else {
        resolve({ url: undefined, dest: url, type: 'http' });
      }
    });
  }

  public resolveZilUnstoppableAPI(domain: string) {
    let resolveFrom = 'https://unstoppabledomains.com/api/v1/' + domain + '.zil'
    return new Promise((resolve, reject) => {
      axios.get(resolveFrom).then((response) => {
        if (response.data['ipfs'] && response.data.ipfs['html']) {
          console.log(response.data.ipfs.html);
          resolve(response.data.ipfs.html);
        } else {
          reject('No valid API response returned');
        }
      });
    });
  }

  public resolveZilZilAPI(domain: string) {
    return new Promise((resolve, reject) => {

      let dmn = domain + '.zil';
      let zil: any = getNamicorn().zns;

      zil.resolution(dmn)
        .then((response: any) => {
          console.log(dmn, ' has addresses ', response);
          try {
            let ipfsAddress: string = response.ipfs.html.value;
            if(!isIPFS.multihash(ipfsAddress)){
              reject({response: 500, mesasge: "IPFS address " + ipfsAddress + " is not a valid IPFS multihash"});
            }else{
              resolve(ipfsAddress);
            }
          } catch (e) {
            reject({response: 400, message: "Address not found"});
          }
        }).catch(console.error)
    })
  }

  public resolveDemoUrl(domain: string) {
    console.log("Demo domain: " + domain);
    if (domain.indexOf('brad') != -1) {
      return this.cdnBaseUrl + "QmefehFs5n8yQcGCVJnBMY3Hr6aMRHtsoniAhsM1KsHMSe/";
    } else if (domain.indexOf('matt') != -1) {
      return this.cdnBaseUrl + "QmUD69diRF8jwju2k4b9mD7PaXMjtMAKafqascL18VKvoD/";
    } else {
      return this.cdnBaseUrl + "QmWcLKHWqrRB95zQnb4vX8RRgoGsVm5YAUHyZyiAw4mCMQ/";
    }
  }

  public get cdnBaseUrl() {
    switch (this.browserSettings.ipfsContentMethod) {
      case IPFSContentMethod.CloudflareCDN:
        return this.CLOUDFLARE_CDN_BASE;
      case IPFSContentMethod.InfuraAPI:
        return this.INFURA_CDN_BASE;
    }

    return this.CLOUDFLARE_CDN_BASE;
  }
}