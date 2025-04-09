
export function VodApiClient(baseUrl) {
  if (!(this instanceof VodApiClient)) {
    return new VodApiClient(baseUrl)
  }
  this.proxy = "https://proxy.mengze.vip/proxy/"
  this.baseUrl = baseUrl
  this.params = []
  return this
}

VodApiClient.prototype.list = function() {
  this.add("ac", "list")
  return this;
}

VodApiClient.prototype.detail = function(ids = []) {
  if (!Array.isArray(ids)) ids = [ids]
  this.add("ac", "detail")
  this.add("ids", ids.join(","))
  return this;
}

VodApiClient.prototype.category = function(type) {
  if (type) this.add("t", type)
  return this;
}

VodApiClient.prototype.page = function(page = 1) {
  this.add("pg", page)
  return this;
}

VodApiClient.prototype.search = function(keyword) {
  this.add("wd", keyword)
  return this;
}

VodApiClient.prototype.add = function(key, value) {
  this.params.push(`${key}=${value}`)
  return this;
}

VodApiClient.prototype.proxy = function(proxy) {
  this.proxy = proxy
  return this;
}

VodApiClient.prototype.fetch = function() {
  const url = this.baseUrl + `/api.php/provide/vod?${this.params.join("&")}`;
  return fetch(this.proxy + encodeURIComponent(url))
}

VodApiClient.prototype.json = function() {
  return this.fetch().then(res => res.json())
}

VodApiClient.prototype.text = function() {
  return this.fetch().then(res => res.text())
}

export default VodApiClient