import { BufferGeometry, Vector3, Float32BufferAttribute, Mesh, Texture, RGBFormat, LinearFilter, MeshPhongMaterial, MeshBasicMaterial, Matrix4, Quaternion, NearestFilter, Raycaster, Vector2, Frustum, Color } from 'three';

/**
 * Map node geometry is a geometry used to represent the spherical map nodes.
 *
 * @class MapSphereNodeGeometry
 * @extends {BufferGeometry}
 * @param {number} width Width of the node.
 * @param {number} height Height of the node.
 * @param {number} widthSegments Number of subdivisions along the width.
 * @param {number} heightSegments Number of subdivisions along the height.
 */
class MapSphereNodeGeometry extends BufferGeometry 
{
	constructor(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength)
	{
		super();

		const thetaEnd = thetaStart + thetaLength;
		let index = 0;
		const grid = [];
		const vertex = new Vector3();
		const normal = new Vector3();

		// Buffers
		const indices = [];
		const vertices = [];
		const normals = [];
		const uvs = [];

		// Generate vertices, normals and uvs
		for (var iy = 0; iy <= heightSegments; iy++)
		{
			const verticesRow = [];
			const v = iy / heightSegments;

			for (var ix = 0; ix <= widthSegments; ix++)
			{
				const u = ix / widthSegments;

				// Vertex
				vertex.x = -radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
				vertex.y = radius * Math.cos(thetaStart + v * thetaLength);
				vertex.z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);

				vertices.push(vertex.x, vertex.y, vertex.z);

				// Normal
				normal.set(vertex.x, vertex.y, vertex.z).normalize();
				normals.push(normal.x, normal.y, normal.z);

				// UV
				uvs.push(u, 1 - v);
				verticesRow.push(index++);
			}

			grid.push(verticesRow);
		}

		// Indices
		for (var iy = 0; iy < heightSegments; iy++)
		{
			for (var ix = 0; ix < widthSegments; ix++)
			{
				const a = grid[iy][ix + 1];
				const b = grid[iy][ix];
				const c = grid[iy + 1][ix];
				const d = grid[iy + 1][ix + 1];

				if (iy !== 0 || thetaStart > 0)
				{
					indices.push(a, b, d);
				}

				if (iy !== heightSegments - 1 || thetaEnd < Math.PI)
				{
					indices.push(b, c, d);
				}
			}
		}

		this.setIndex(indices);
		this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
		this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
		this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
	}
}

/**
 * A map provider is a object that handles the access to map tiles of a specific service.
 *
 * They contain the access configuration and are responsible for handling the map theme size etc.
 *
 * MapProvider should be used as a base for all the providers.
 *
 * @class MapProvider
 */
class MapProvider
{
	constructor()
	{
		/** 
		 * Name of the map provider
		 *
		 * @attribute name
		 * @type {string}
		 */
		this.name = "";
		
		/**
		 * Minimum tile level.
		 * 
		 * @attribute minZoom
		 * @type {number}
		 */
		this.minZoom = 0;

		/**
		 * Maximum tile level.
		 * 
		 * @attribute maxZoom
		 * @type {number}
		 */
		this.maxZoom = 20;

		/**
		 * Map bounds.
		 *
		 * @attribute bounds
		 * @type {Array}
		 */
		this.bounds = [];

		/**
		 * Map center point.
		 *
		 * @attribute center
		 * @type {Array}
		 */
		this.center = [];
	}

	/**
	 * Get a tile for the x, y, zoom based on the provider configuration.
	 * 
	 * The tile should be returned as a image object, compatible with canvas context 2D drawImage() and with webgl texImage2D() method.
	 *
	 * @method fetchTile
	 * @param {number} zoom Zoom level.
	 * @param {number} x Tile x.
	 * @param {number} y Tile y.
	 * @return {Promise<HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap>} Promise with the image obtained for the tile ready to use.
	 */
	fetchTile(zoom, x, y) {}

	/**
	 * Get map meta data from server if supported.
	 *
	 * Usually map server have API method to retrieve TileJSON metadata.
	 * 
	 * @method getMetaData
	 */
	getMetaData() {}
}

/**
 * Cancelable promises extend base promises and provide a cancel functionality than can be used to cancel the execution or task of the promise.
 * 
 * These type of promises can be used to prevent additional processing when the data is not longer required (e.g. HTTP request for data that is not longer necessary)
 * 
 * @class CancelablePromise
 */
class CancelablePromise
{
	constructor(executor) 
	{
		let onResolve;
		let onReject;
	
		let fulfilled = false;
		let rejected = false;
		let called = false;
		let value;
	
		function resolve(v) 
		{
			fulfilled = true;
			value = v;
	
			if (typeof onResolve === "function") 
			{
				onResolve(value);
				called = true;
			}
		}
	
		function reject(reason) 
		{
			rejected = true;
			value = reason;
	
			if (typeof onReject === "function") 
			{
				onReject(value);
				called = true;
			}
		}
	
		/**
		 * Request to cancel the promise execution.
		 * 
		 * @returns {boolean} True if the promise is canceled successfully, false otherwise.
		 */
		this.cancel = function()
		{
			// TODO <ADD CODE HERE>
			return false;
		};
	
		/**
		 * Executed after the promise is fulfilled.
		 * 
		 * @param {*} callback 
		 */
		this.then = function(callback) 
		{
			onResolve = callback;
	
			if (fulfilled && !called) 
			{
				called = true;
				onResolve(value);
			}
			return this;
		};
	
		/**
		 * Catch any error that occurs in the promise.
		 * 
		 * @param {*} callback 
		 */
		this.catch = function(callback) 
		{
			onReject = callback;
	
			if (rejected && !called) 
			{
				called = true;
				onReject(value);
			}
			return this;
		};
	
		try 
		{
			executor(resolve, reject);
		}
		catch (error) 
		{
			reject(error);
		}
	}

	/**
	 * Create a resolved promise.
	 * 
	 * @param {*} val Value to pass.
	 * @returns {CancelablePromise} Promise created with resolve value.
	 */
	static resolve(val)
	{
		return new CancelablePromise(function executor(resolve, _reject) 
		{
			resolve(val);
		});
	}

	/**
	 * Create a rejected promise.
	 * 
	 * @param {*} reason 
	 * @returns {CancelablePromise} Promise created with rejection reason.
	 */
	static reject(reason)
	{
		return new CancelablePromise(function executor(resolve, reject) 
		{
			reject(reason);
		});
	}
	
	/**
	 * Wait for a set of promises to finish, creates a promise that waits for all running promises.
	 * 
	 * If any of the promises fail it will reject altough some of them may have been completed with success.
	 * 
	 * @param {*} promises 
	 * @returns {CancelablePromise} Promise that will resolve when all of the running promises are fullfilled.
	 */
	static all(promises) 
	{
		let fulfilledPromises = [];
		let result = [];

		function executor(resolve, reject) 
		{
			promises.forEach((promise, index) => 
			{
				return promise
					.then((val) => 
					{
						fulfilledPromises.push(true);
						result[index] = val;

						if (fulfilledPromises.length === promises.length) 
						{
							return resolve(result);
						}
					})
					.catch((error) => {return reject(error);});
			}
			);
		}

		return new CancelablePromise(executor);
	}
}

/**
 * Open street maps tile server.
 *
 * Works with any service that uses a address/zoom/x/y.format URL for tile access.
 *
 * @class OpenStreetMapsProvider
 */
class OpenStreetMapsProvider extends MapProvider
{
	constructor(address)
	{
		super();

		/**
		 * Map server address.
		 *
		 * By default the open OSM tile server is used.
		 * 
		 * @attribute address
		 * @type {string}
		 */
		this.address = address !== undefined ? address : "https://a.tile.openstreetmap.org/";

		/**
		 * Map image tile format.
		 * 
		 * @attribute format
		 * @type {string}
		 */
		this.format = "png";
	}

	fetchTile(zoom, x, y)
	{
		return new CancelablePromise((resolve, reject) =>
		{
			var image = document.createElement("img");
			image.onload = function() {resolve(image);};
			image.onerror = function() {reject();};
			image.crossOrigin = "Anonymous";
			image.src = this.address + "/" + zoom + "/" + x + "/" + y + "." + this.format;
		});
	}
}

const autoLod = true;

/** 
 * Represents a map tile node inside of the tiles quad-tree
 * 
 * Each map node can be subdivided into other nodes.
 * 
 * It is intended to be used as a base class for other map node implementations.
 * 
 * @class MapNode
 */
class MapNode$1 extends Mesh
{
	constructor(geometry, material, parentNode, mapView, location, level, x, y)
	{
		super(geometry, material);

		/**
		 * The map view.
		 *
		 * @attribute mapView
		 * @type {MapView}
		 */
		this.mapView = mapView;
	
		/**
		 * Parent node (from an upper tile level).
		 * 
		 * @attribute parentNode
		 * @type {MapPlaneNode}
		 */
		this.parentNode = parentNode;
		
		/**
		 * Index of the map node in the quad-tree parent node.
		 *
		 * Position in the tree parent, can be TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT or BOTTOM_RIGHT.
		 *
		 * @attribute location
		 * @type {number}
		 */
		this.location = location;
	
		/**
		 * Tile level of this node.
		 * 
		 * @attribute level
		 * @type {number}
		 */
		this.level = level;
	
		/**
		 * Tile x position.
		 * 
		 * @attribute x
		 * @type {number}
		 */
		this.x = x;
	
		/**
		 * Tile y position.
		 * 
		 * @attribute y
		 * @type {number}
		 */
		this.y = y;
	
		/**
		 * Indicates how many children nodes where loaded.
		 *
		 * @attribute nodesLoaded
		 * @type {number}
		 */
		this.nodesLoaded = 0;
	
		/** 
		 * Variable to check if the node is subdivided.
		 *
		 * To avoid bad visibility changes on node load.
		 *
		 * @attribute subdivided
		 * @type {boolean}
		 */
		this.subdivided = false;
		
		/**
		 * Cache with the children objects created from subdivision.
		 * 
		 * Used to avoid recreate object after simplification and subdivision.
		 * 
		 * The default value is null.
		 *
		 * @attribute childrenCache
		 * @type {Array}
		 */
		this.childrenCache = null;

		this.visible = autoLod;
		this.isReady = !autoLod;

		this.objectsHolder = new THREE.Group();
		this.objectsHolder.visible = autoLod;
		this.add(this.objectsHolder);
	}
	
	/**
	 * How many children each branch of the tree has.
	 *
	 * For a quad-tree this value is 4.
	 *
	 * @static
	 * @attribute CHILDRENS
	 * @type {number}
	 */
	static CHILDRENS = 4;
	
	/**
	 * Root node has no location.
	 *
	 * @static
	 * @attribute ROOT
	 * @type {number}
	 */
	static ROOT = -1;
	
	/**
	 * Index of top left quad-tree branch node.
	 *
	 * Can be used to navigate the children array looking for neighbors.
	 *
	 * @static
	 * @attribute TOP_LEFT
	 * @type {number}
	 */
	static TOP_LEFT = 0;
	
	/**
	 * Index of top left quad-tree branch node.
	 *
	 * Can be used to navigate the children array looking for neighbors.
	 *
	 * @static
	 * @attribute TOP_RIGHT
	 * @type {number}
	 */
	static TOP_RIGHT = 1;
	
	/**
	 * Index of top left quad-tree branch node.
	 *
	 * Can be used to navigate the children array looking for neighbors.
	 *
	 * @static
	 * @attribute BOTTOM_LEFT
	 * @type {number}
	 */
	static BOTTOM_LEFT = 2;
	
	/**
	 * Index of top left quad-tree branch node.
	 *
	 * Can be used to navigate the children array looking for neighbors.
	 *
	 * @static
	 * @attribute BOTTOM_RIGHT
	 * @type {number}
	 */
	static BOTTOM_RIGHT = 3;
	
	/**
	 * Create the child nodes to represent the next tree level.
	 *
	 * These nodes should be added to the object, and their transformations matrix should be updated.
	 *
	 * @method createChildNodes 
	 */
	createChildNodes() {}
	
	/**
	 * Subdivide node,check the maximum depth allowed for the tile provider.
	 *
	 * Uses the createChildNodes() method to actually create the child nodes that represent the next tree level.
	 * 
	 * @method subdivide
	 */
	subdivide()
	{
		const maxZoom = Math.min (this.mapView.provider.maxZoom, this.mapView.heightProvider.maxZoom);
		if (this.subdivided || this.children.length > 1 || this.level + 1 > maxZoom
		//  || this.parentNode !== null && this.parentNode.nodesLoaded < MapNode.CHILDRENS
			 )
		{
			return;
		}
	
		this.subdivided = true;
		if (this.childrenCache !== null)
		{
			this.isMesh = false;
			this.objectsHolder.visible = false;
			this.childrenCache.forEach((n) => 
			{
				if (n !== this.objectsHolder) 
				{
					n.isMesh = !n.subdivided;
					n.objectsHolder.visible = !n.subdivided;
				}
			});
			this.children = this.childrenCache;
			{
				return this.children;
			}
		}
		else
		{
			this.createChildNodes();
			{
				return this.children;
			}
		}
	}
	
	/**
	 * Simplify node, remove all children from node, store them in cache.
	 *
	 * Reset the subdivided flag and restore the visibility.
	 *
	 * This base method assumes that the node implementation is based off Mesh and that the isMesh property is used to toggle visibility.
	 *
	 * @method simplify
	 */
	simplify()
	{
		if (!this.subdivided) 
		{
			return;
		}
		this.childrenCache = this.children;
	
		this.objectsHolder.visible = true;
		this.subdivided = false;
		this.isMesh = true;
		this.children = [this.objectsHolder];
		{
			return this;
		}
	}
	
	/**
	 * Load tile texture from the server.
	 * 
	 * This base method assumes the existence of a material attribute with a map texture.
	 *
	 * @method loadTexture
	 * @param {Function} onLoad 
	 */
	loadTexture(onLoad)
	{
		this.isReady = true;
		var self = this;
		
		this.mapView.fetchTile(this.level, this.x, this.y).then(function(image)
		{
			var texture = new Texture(image);
			texture.generateMipmaps = false;
			texture.format = RGBFormat;
			texture.magFilter = LinearFilter;
			texture.minFilter = LinearFilter;
			texture.needsUpdate = true;
	
			self.material.map = texture;
			self.nodeReady();
		}).catch(function()
		{
			var canvas = new OffscreenCanvas(1, 1);
			var context = canvas.getContext("2d");
			context.fillStyle = "#FF0000";
			context.fillRect(0, 0, 1, 1);
	
			var texture = new Texture(image);
			texture.generateMipmaps = false;
			texture.needsUpdate = true;
	
			self.material.map = texture;
			self.nodeReady();
		});
	}
	
	/** 
	 * Increment the child loaded counter.
	 *
	 * Should be called after a map node is ready for display.
	 *
	 * @method nodeReady
	 */
	nodeReady()
	{
		// Update parent nodes loaded
		this.isMesh = true;
		const parentNode = this.parentNode;
		if (parentNode !== null)
		{
			parentNode.nodesLoaded++;
			if (parentNode.nodesLoaded >= MapNode$1.CHILDRENS)
			{
				if (parentNode.subdivided === true)
				{
					parentNode.isMesh = false;
					parentNode.objectsHolder.visible = false;
				}
				
				parentNode.children.forEach((child, index) => 
				{
					if (child !== parentNode.objectsHolder) 
					{
						// child.visible = true;
						// child.objectsHolder.visible = true;
						// child.visible = true;
						child.isMesh = !child.subdivided;
						child.objectsHolder.visible = !child.subdivided;
					}
				});
			}
		}
		// If its the root object just set visible
		else if (!this.subdivided)
		{
			this.visible = true;
			this.objectsHolder.visible = true;
		}
	}
	
	/**
	 * Get all the neighbors in a specific direction (left, right, up down).
	 *
	 * @method getNeighborsDirection
	 * @param {number} direction
	 * @return {MapNode[]} The neighbors array, if no neighbors found returns empty.
	 */
	getNeighborsDirection(direction)
	{
		// TODO <ADD CODE HERE>
	
		return null;
	}
	
	/**
	 * Get all the quad tree nodes neighbors. Are considered neighbors all the nodes directly in contact with a edge of this node.
	 *
	 * @method getNeighbors
	 * @return {MapNode[]} The neighbors array, if no neighbors found returns empty.
	 */
	getNeighbors()
	{
		var neighbors = [];
	
		// TODO <ADD CODE HERE>
	
		return neighbors;
	}
}

/**
 * Map node geometry is a geometry used to represent the map nodes.
 *
 * Consists of a XZ plane with normals facing +Y.
 *
 * @class MapNodeGeometry
 * @extends {BufferGeometry}
 * @param {number} width Width of the node.
 * @param {number} height Height of the node.
 * @param {number} widthSegments Number of subdivisions along the width.
 * @param {number} heightSegments Number of subdivisions along the height.
 */
class MapNodeGeometry extends BufferGeometry
{
	constructor(width, height, widthSegments, heightSegments)
	{
		super();

		const widthHalf = width / 2;
		const heightHalf = height / 2;

		const gridX = widthSegments + 1;
		const gridZ = heightSegments + 1;

		const segmentWidth = width / widthSegments;
		const segmentHeight = height / heightSegments;

		// Buffers
		const indices = [];
		const vertices = [];
		const normals = [];
		const uvs = [];

		// Generate vertices, normals and uvs
		for (var iz = 0; iz < gridZ; iz++)
		{
			const z = iz * segmentHeight - heightHalf;

			for (var ix = 0; ix < gridX; ix++)
			{
				const x = ix * segmentWidth - widthHalf;

				vertices.push(x, 0, z);
				normals.push(0, 1, 0);
				uvs.push(ix / widthSegments);
				uvs.push(1 - iz / heightSegments);
			}
		}

		// Indices
		for (var iz = 0; iz < heightSegments; iz++)
		{
			for (var ix = 0; ix < widthSegments; ix++)
			{
				const a = ix + gridX * iz;
				const b = ix + gridX * (iz + 1);
				const c = ix + 1 + gridX * (iz + 1);
				const d = ix + 1 + gridX * iz;

				// faces
				indices.push(a, b, d);
				indices.push(b, c, d);
			}
		}

		this.setIndex(indices);
		this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
		this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
		this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
	}
}

/** 
 * Represents a height map tile node that can be subdivided into other height nodes.
 * 
 * Its important to update match the height of the tile with the neighbors nodes edge heights to ensure proper continuity of the surface.
 * 
 * The height node is designed to use MapBox elevation tile encoded data as described in https://www.mapbox.com/help/access-elevation-data/
 *
 * @class MapHeightNode
 * @param parentNode {MapHeightNode} The parent node of this node.
 * @param mapView {MapView} Map view object where this node is placed.
 * @param location {number} Position in the node tree relative to the parent.
 * @param level {number} Zoom level in the tile tree of the node.
 * @param x {number} X position of the node in the tile tree.
 * @param y {number} Y position of the node in the tile tree.
 * @param material {Material} Material used to render this height node.
 * @param geometry {Geometry} Geometry used to render this height node.
 */
class MapHeightNode extends MapNode$1
{
	constructor(parentNode, mapView, location, level, x, y, material, geometry)
	{
		if (material === undefined)
		{
			material = new MeshPhongMaterial(
				{
					color: 0x000000,
					specular: 0x000000,
					shininess: 0,
					wireframe: false,
					emissive: 0xFFFFFF
				});
		}
	
		super(geometry === undefined ? MapHeightNode.GEOMETRY: geometry, material, parentNode, mapView, location, level, x, y);
	
		this.matrixAutoUpdate = false;
		this.isMesh = false;
			
		/**
		 * Flag indicating if the tile texture was loaded.
		 * 
		 * @attribute textureLoaded
		 * @type {boolean}
		 */
		this.textureLoaded = false;
	
		/**
		 * Flag indicating if the tile height data was loaded.
		 * 
		 * @attribute heightLoaded
		 * @type {boolean}
		 */
		this.heightLoaded = false;
		if (this.isReady) 
		{
			this.loadTexture();
		}
	}
	
	/**
	 * Original tile size of the images retrieved from the height provider.
	 *
	 * @static
	 * @attribute TILE_SIZE
	 * @type {number}
	 */
	static TILE_SIZE = 256;
	
	/**
	 * Size of the grid of the geometry displayed on the scene for each tile.
	 *
	 * @static
	 * @attribute GEOMETRY_SIZE
	 * @type {number}
	 */
	 static GEOMETRY_SIZE = 16;
	
	 /**
	 * Map node plane geometry.
	 *
	 * @static
	 * @attribute GEOMETRY
	 * @type {PlaneBufferGeometry}
	 */
	 static GEOMETRY = new MapNodeGeometry(1, 1, MapHeightNode.GEOMETRY_SIZE, MapHeightNode.GEOMETRY_SIZE);
	
	 /**
	 * Load tile texture from the server.
	 * 
	 * Aditionally in this height node it loads elevation data from the height provider and generate the appropiate maps.
	 *
	 * @method loadTexture
	 */
	 loadTexture()
	 {
		 this.isReady = true;
	 	var self = this;
	
	 	this.mapView.fetchTile(this.level, this.x, this.y).then(function(image)
	 	{
	 		if (image) 
	 		{
	 			var texture = new Texture(image);
	 			texture.generateMipmaps = false;
	 			texture.format = RGBFormat;
	 			texture.magFilter = LinearFilter;
	 			texture.minFilter = LinearFilter;
	 			texture.needsUpdate = true;
				
	 			self.material.emissiveMap = texture;
	 		}
	
	 	}).finally(function()
	 	{
	 		self.textureLoaded = true;
	 		self.nodeReady();
	 	});
	
	 	this.loadHeightGeometry();
	 };
	
	 nodeReady()
	 {
	 	if (!this.heightLoaded || !this.textureLoaded)
	 	{
	 		return;
	 	}
	
	 	this.visible = true;
	
	 	MapNode$1.prototype.nodeReady.call(this);
	 	this.mapView.onNodeReady();
	 };
	
	 createChildNodes()
	 {
	 	var level = this.level + 1;
	
	 	var x = this.x * 2;
	 	var y = this.y * 2;

	 	var node = new this.constructor(this, this.mapView, MapNode$1.TOP_LEFT, level, x, y);
	 	node.scale.set(0.5, 1, 0.5);
	 	node.position.set(-0.25, 0, -0.25);
	 	this.add(node);
	 	node.updateMatrix();
	 	node.updateMatrixWorld(true);
	
	 	var node = new this.constructor(this, this.mapView, MapNode$1.TOP_RIGHT, level, x + 1, y);
	 	node.scale.set(0.5, 1, 0.5);
	 	node.position.set(0.25, 0, -0.25);
	 	this.add(node);
	 	node.updateMatrix();
	 	node.updateMatrixWorld(true);
	
	 	var node = new this.constructor(this, this.mapView, MapNode$1.BOTTOM_LEFT, level, x, y + 1);
	 	node.scale.set(0.5, 1, 0.5);
	 	node.position.set(-0.25, 0, 0.25);
	 	this.add(node);
	 	node.updateMatrix();
	 	node.updateMatrixWorld(true);
	
	 	var node = new this.constructor(this, this.mapView, MapNode$1.BOTTOM_RIGHT, level, x + 1, y + 1);
	 	node.scale.set(0.5, 1, 0.5);
	 	node.position.set(0.25, 0, 0.25);
	 	this.add(node);
	 	node.updateMatrix();
	 	node.updateMatrixWorld(true);

	 };
	
	 /** 
	 * Load height texture from the server and create a geometry to match it.
	 *
	 * @method loadHeightGeometry
	 * @return {Promise<void>} Returns a promise indicating when the geometry generation has finished. 
	 */
	 loadHeightGeometry()
	 {
	 	if (this.mapView.heightProvider === null)
	 	{
	 		throw new Error("GeoThree: MapView.heightProvider provider is null.");
	 	}
		
	 	var self = this;
	
	 	this.mapView.heightProvider.fetchTile(this.level, this.x, this.y).then(function(image)
	 	{
			 if (image) 
	 		{
	 			var geometry = new MapNodeGeometry(1, 1, MapHeightNode.GEOMETRY_SIZE, MapHeightNode.GEOMETRY_SIZE);
	 			var vertices = geometry.attributes.position.array;
		   
	 			var canvas = new OffscreenCanvas(MapHeightNode.GEOMETRY_SIZE + 1, MapHeightNode.GEOMETRY_SIZE + 1);
	   
	 			var context = canvas.getContext("2d");
	 			context.imageSmoothingEnabled = false;
	 			context.drawImage(image, 0, 0, image.width, image.width, 0, 0, canvas.width, canvas.height);
			   
	 			var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	 			var data = imageData.data;
	 			for (var i = 0, j = 0; i < data.length && j < vertices.length; i += 4, j += 3)
	 			{
	 				var r = data[i];
	 				var g = data[i + 1];
	 				var b = data[i + 2];
	   
	 				// The value will be composed of the bits RGB
	 				var value = (r * 65536 + g * 256 + b) * 0.1 - 1e4;
	   
	 				vertices[j + 1] = value;
	 			}
	   
	 			self.geometry = geometry;
			 }
	 	}).catch(function() 
	 	{
			 console.log('error fetching heugh');
	 		// self.geometry = new MapNodeGeometry(1, 1, MapHeightNode.GEOMETRY_SIZE, MapHeightNode.GEOMETRY_SIZE);
	 	}).finally(function()
	 	{
	 		self.heightLoaded = true;
	 		self.nodeReady();
	 	});
	 };
	
	 /**
	 * Overrides normal raycasting, to avoid raycasting when isMesh is set to false.
	 * 
	 * @method raycast
	 */
	 raycast(raycaster, intersects)
	 {
	 	if (this.isMesh === true)
	 	{
	 		return Mesh.prototype.raycast.call(this, raycaster, intersects);
	 	}
	
	 	return false;
	 };
}

/** 
 * Represents a basic plane tile node.
 * 
 * @class MapPlaneNode
 */
class MapPlaneNode extends MapNode$1
{
	constructor(parentNode, mapView, location, level, x, y)
	{
		super(MapPlaneNode.GEOMETRY, new MeshBasicMaterial({wireframe: false}), parentNode, mapView, location, level, x, y);
	
		this.matrixAutoUpdate = false;
		this.isMesh = true;
		
		if (this.isReady) 
		{
			this.loadTexture();
		}
	}
	
	/**
	 * Map node plane geometry.
	 *
	 * @static
	 * @attribute GEOMETRY
	 * @type {PlaneBufferGeometry}
	 */
	static GEOMETRY = new MapNodeGeometry(1, 1, 1, 1);
	
	createChildNodes()
	{
		var level = this.level + 1;
	
		var x = this.x * 2;
		var y = this.y * 2;
		
	
		var node = new MapPlaneNode(this, this.mapView, MapNode$1.TOP_LEFT, level, x, y);
		node.scale.set(0.5, 1, 0.5);
		node.position.set(-0.25, 0, -0.25);
		this.add(node);
		node.updateMatrix();
		node.updateMatrixWorld(true);
	
		var node = new MapPlaneNode(this, this.mapView, MapNode$1.TOP_RIGHT, level, x + 1, y);
		node.scale.set(0.5, 1, 0.5);
		node.position.set(0.25, 0, -0.25);
		this.add(node);
		node.updateMatrix();
		node.updateMatrixWorld(true);
	
		var node = new MapPlaneNode(this, this.mapView, MapNode$1.BOTTOM_LEFT, level, x, y + 1);
		node.scale.set(0.5, 1, 0.5);
		node.position.set(-0.25, 0, 0.25);
		this.add(node);
		node.updateMatrix();
		node.updateMatrixWorld(true);
	
		var node = new MapPlaneNode(this, this.mapView, MapNode$1.BOTTOM_RIGHT, level, x + 1, y + 1);
		node.scale.set(0.5, 1, 0.5);
		node.position.set(0.25, 0, 0.25);
		this.add(node);
		node.updateMatrix();
		node.updateMatrixWorld(true);
	}
	
	/**
	 * Overrides normal raycasting, to avoid raycasting when isMesh is set to false.
	 * 
	 * @method raycast
	 */
	raycast(raycaster, intersects)
	{
		if (this.isMesh === true)
		{
			return Mesh.prototype.raycast.call(this, raycaster, intersects);
		}
	
		return false;
	}
}

/**
 * Location utils contains utils to access the user location (GPS, IP location or wifi) and convert data between representations.
 *
 * Devices with a GPS, for example, can take a minute or more to get a GPS fix, so less accurate data (IP location or wifi) may be returned.
 *
 * @static
 * @class UnitsUtils
 */
class UnitsUtils 
{
	/**
	 * Aproximated radius of earth in meters.
	 *
	 * @static
	 * @attribute EARTH_RADIUS
	 */
	static EARTH_RADIUS = 6378137;

	/**
	 * Earth equator perimeter in meters.
	 *
	 * @static
	 * @attribute EARTH_RADIUS
	 */
	static EARTH_PERIMETER = 2 * Math.PI * UnitsUtils.EARTH_RADIUS;

	/**
	 * Earth equator perimeter in meters.
	 *
	 * @static
	 * @attribute EARTH_ORIGIN
	 */
	static EARTH_ORIGIN = UnitsUtils.EARTH_PERIMETER / 2.0;

	/**
	 * Get the current geolocation from the browser using the location API.
	 * 
	 * This location can be provided from GPS measure, estimated IP location or any other system available in the host. Precision may vary.
	 *
	 * @method get
	 * @param {Function} onResult Callback function onResult(coords, timestamp).
	 */
	static get(onResult, onError)
	{
		navigator.geolocation.getCurrentPosition(function(result)
		{
			onResult(result.coords, result.timestamp);
		}, onError);
	}

	/**
	 * Converts given lat/lon in WGS84 Datum to XY in Spherical Mercator EPSG:900913.
	 *
	 * @method datumsToSpherical
	 * @param {number} latitude
	 * @param {number} longitude
	 */
	static datumsToSpherical(latitude, longitude)
	{
		var x = longitude * UnitsUtils.EARTH_ORIGIN / 180.0;
		var y = Math.log(Math.tan((90 + latitude) * Math.PI / 360.0)) / (Math.PI / 180.0);

		y = y * UnitsUtils.EARTH_ORIGIN / 180.0;

		return {x: x, y: y};
	}

	/**
	 * Converts XY point from Spherical Mercator EPSG:900913 to lat/lon in WGS84 Datum.
	 *
	 * @method sphericalToDatums
	 * @param {number} x
	 * @param {number} y
	 */
	static sphericalToDatums(x, y)
	{
		var longitude = x / UnitsUtils.EARTH_ORIGIN * 180.0;
		var latitude = y / UnitsUtils.EARTH_ORIGIN * 180.0;

		latitude = 180.0 / Math.PI * (2 * Math.atan(Math.exp(latitude * Math.PI / 180.0)) - Math.PI / 2.0);

		return {latitude: latitude, longitude: longitude};
	}

	/**
	 * Converts quad tree zoom/x/y to lat/lon in WGS84 Datum.
	 *
	 * @method quadtreeToDatums
	 * @param {number} zoom
	 * @param {number} x
	 * @param {number} y
	 */
	static quadtreeToDatums(zoom, x, y)
	{
		var n = Math.pow(2.0, zoom);
		var longitude = x / n * 360.0 - 180.0;
		var latitudeRad = Math.atan(Math.sinh(Math.PI * (1.0 - 2.0 * y / n)));
		var latitude = 180.0 * (latitudeRad / Math.PI);

		return {latitude: latitude, longitude: longitude};
	}
}

/** 
 * Represents a map tile node.
 * 
 * A map node can be subdivided into other nodes (Quadtree).
 * 
 * @class MapSphereNode
 */
class MapSphereNode extends MapNode$1
{
	constructor(parentNode, mapView, location, level, x, y)
	{
		super(MapSphereNode.createGeometry(level, x, y), new MeshBasicMaterial({wireframe: false}), parentNode, mapView, location, level, x, y);
	
		this.applyScaleNode();
	
		this.matrixAutoUpdate = false;
		this.isMesh = true;
	
		if (this.isReady) 
		{
			this.loadTexture();
		}
	}
	
	/**
	 * Number of segments per node geometry.
	 *
	 * @STATIC
	 * @static SEGMENTS
	 * @type {number}
	 */
	static SEGMENTS = 80;
	
	/**
	 * Create a geometry for a sphere map node.
	 *
	 * @method createGeometry
	 * @param {number} zoom
	 * @param {number} x
	 * @param {number} y
	 */
	static createGeometry(zoom, x, y)
	{
		var range = Math.pow(2, zoom);
		var max = 40;
		var segments = Math.floor(MapSphereNode.SEGMENTS * (max / (zoom + 1)) / max);
	
		// X
		var phiLength = 1 / range * 2 * Math.PI;
		var phiStart = x * phiLength;
	
		// Y
		var thetaLength = 1 / range * Math.PI;
		var thetaStart = y * thetaLength;
	
		return new MapSphereNodeGeometry(1, segments, segments, phiStart, phiLength, thetaStart, thetaLength);
	}
	
	/** 
	 * Apply scale and offset position to the sphere node geometry.
	 *
	 * @method applyScaleNode
	 */
	applyScaleNode()
	{
		this.geometry.computeBoundingBox();
	
		var box = this.geometry.boundingBox.clone();
		var center = box.getCenter(new Vector3());
	
		var matrix = new Matrix4();
		matrix.compose(new Vector3(-center.x, -center.y, -center.z), new Quaternion(), new Vector3(UnitsUtils.EARTH_RADIUS, UnitsUtils.EARTH_RADIUS, UnitsUtils.EARTH_RADIUS));
		this.geometry.applyMatrix4(matrix);
	
		this.position.copy(center);
	
		this.updateMatrix();
		this.updateMatrixWorld();
	}
	
	updateMatrix()
	{
		this.matrix.setPosition(this.position);
		this.matrixWorldNeedsUpdate = true;
	}
	
	updateMatrixWorld(force)
	{
		if (this.matrixWorldNeedsUpdate || force)
		{
			this.matrixWorld.copy(this.matrix);
			this.matrixWorldNeedsUpdate = false;
		}
	}
	
	createChildNodes()
	{
		var level = this.level + 1;
	
		var x = this.x * 2;
		var y = this.y * 2;
	
		var node = new MapSphereNode(this, this.mapView, MapNode$1.TOP_LEFT, level, x, y);
		this.add(node);
		node.updateMatrix();
		node.updateMatrixWorld(true);
	
		var node = new MapSphereNode(this, this.mapView, MapNode$1.TOP_RIGHT, level, x + 1, y);
		this.add(node);
		node.updateMatrix();
		node.updateMatrixWorld(true);
	
		var node = new MapSphereNode(this, this.mapView, MapNode$1.BOTTOM_LEFT, level, x, y + 1);
		this.add(node);
		node.updateMatrix();
		node.updateMatrixWorld(true);
	
		var node = new MapSphereNode(this, this.mapView, MapNode$1.BOTTOM_RIGHT, level, x + 1, y + 1);
		this.add(node);
		node.updateMatrix();
		node.updateMatrixWorld(true);
	}
	
	/**
	 * Overrides normal raycasting, to avoid raycasting when isMesh is set to false.
	 * 
	 * @method raycast
	 */
	raycast(raycaster, intersects)
	{
		if (this.isMesh === true)
		{
			return Mesh.prototype.raycast.call(this, raycaster, intersects);
		}
	
		return false;
	}
}

/**
 * Map height node that uses GPU height calculation to generate the deformed plane mesh.
 * 
 * This solution is faster if no mesh interaction is required since all trasnformations are done in the GPU the transformed mesh cannot be accessed for CPU operations (e.g. raycasting).
 *
 * @class MapHeightNodeShader
 * @param parentNode {MapHeightNode} The parent node of this node.
 * @param mapView {MapView} Map view object where this node is placed.
 * @param location {number} Position in the node tree relative to the parent.
 * @param level {number} Zoom level in the tile tree of the node.
 * @param x {number} X position of the node in the tile tree.
 * @param y {number} Y position of the node in the tile tree.
 */
class MapHeightNodeShader extends MapHeightNode
{
	constructor(parentNode, mapView, location, level, x, y)
	{
		var material = new MeshPhongMaterial({map: MapHeightNodeShader.EMPTY_TEXTURE});
		material = MapHeightNodeShader.prepareMaterial(material);
	
		super(parentNode, mapView, location, level, x, y, material, MapHeightNodeShader.GEOMETRY);
	
		this.frustumCulled = false;
	}
	
	/**
	 * Empty texture used as a placeholder for missing textures.
	 * 
	 * @static
	 * @attribute EMPTY_TEXTURE
	 * @type {Texture}
	 */
	static EMPTY_TEXTURE = new Texture();
	
	/**
	 * Size of the grid of the geometry displayed on the scene for each tile.
	 * 
	 * @static
	 * @attribute GEOMETRY_SIZE
	 * @type {number}
	 */
	static GEOMETRY_SIZE = 256;
	
	/**
	 * Map node plane geometry.
	 *
	 * @static
	 * @attribute GEOMETRY
	 * @type {PlaneBufferGeometry}
	 */
	static GEOMETRY = new MapNodeGeometry(1, 1, MapHeightNode.GEOMETRY_SIZE, MapHeightNode.GEOMETRY_SIZE);
	
	/**
	 * Prepare the threejs material to be used in the map tile.
	 * 
	 * @param {Material} material Material to be transformed. 
	 */
	static prepareMaterial(material)
	{
		material.userData = {heightMap: {value: MapHeightNodeShader.EMPTY_TEXTURE}};
	
		material.onBeforeCompile = (shader) =>
		{
			// Pass uniforms from userData to the
			for (let i in material.userData)
			{
				shader.uniforms[i] = material.userData[i];
			}
	
			// Vertex variables
			shader.vertexShader = `
			uniform sampler2D heightMap;
			` + shader.vertexShader;
	
			// Vertex depth logic
			shader.vertexShader = shader.vertexShader.replace("#include <fog_vertex>", `
			#include <fog_vertex>
	
			// Calculate height of the title
			vec4 _theight = texture2D(heightMap, vUv);
			float _height = ((_theight.r * 255.0 * 65536.0 + _theight.g * 255.0 * 256.0 + _theight.b * 255.0) * 0.1) - 10000.0;
			vec3 _transformed = position + _height * normal;
	
			// Vertex position based on height
			gl_Position = projectionMatrix * modelViewMatrix * vec4(_transformed, 1.0);
			`);
		};
	
		return material;
	};
	
	loadTexture()
	{
		this.isReady = true;
		var self = this;
	
		this.mapView.fetchTile(this.level, this.x, this.y).then(function(image)
		{
			if (image)
			{
				var texture = new Texture(image);
				texture.generateMipmaps = false;
				texture.format = RGBFormat;
				texture.magFilter = LinearFilter;
				texture.minFilter = LinearFilter;
				texture.needsUpdate = true;
		
				self.material.map = texture;
			}
			
		}).finally(function()
		{
			self.textureLoaded = true;
			self.nodeReady();
		});
	
		this.loadHeightGeometry();
	}

	async onHeightImage(image) 
	{
		if (image) 
		{
				
			var texture = new Texture(image);
			texture.generateMipmaps = false;
			texture.format = RGBFormat;
			texture.magFilter = NearestFilter;
			texture.minFilter = NearestFilter;
			texture.needsUpdate = true;
	
			self.material.userData.heightMap.value = texture;
		}
	}
	
	loadHeightGeometry()
	 {
	 	if (this.mapView.heightProvider === null)
	 	{
	 		throw new Error("GeoThree: MapView.heightProvider provider is null.");
	 	}
		
	 	this.mapView.heightProvider.fetchTile(this.level, this.x, this.y).then((image) =>
	 	{	
			return this.onHeightImage(image);
	 	}).finally(() => 
		 {
			this.heightLoaded = true;
			this.nodeReady();
		  });
	 };
	
	/**
	 * Overrides normal raycasting, to avoid raycasting when isMesh is set to false.
	 * 
	 * Switches the geometry for a simpler one for faster raycasting.
	 * 
	 * @method raycast
	 */
	raycast(raycaster, intersects)
	{
		if (this.isMesh === true)
		{
			this.geometry = MapPlaneNode.GEOMETRY;
	
			var result = Mesh.prototype.raycast.call(this, raycaster, intersects);
	
			this.geometry = MapHeightNodeShader.GEOMETRY;
	
			return result;
		}
	
		return false;
	}
}

class LODControl
{
	updateLOD(view, camera, renderer, scene) {}
}

/**
 * Use random raycasting to randomly pick n objects to be tested on screen space.
 * 
 * Overall the fastest solution but does not include out of screen objects.
 * 
 * @class LODRaycast
 * @extends {LODControl}
 */
class LODRaycast extends LODControl
{
	constructor()
	{
		super();

		/**
		 * Number of rays used to test nodes and subdivide the map.
		 *
		 * N rays are cast each frame dependeing on this value to check distance to the visible map nodes. A single ray should be enough for must scenarios.
		 *
		 * @attribute subdivisionRays
		 * @type {boolean}
		 */
		this.subdivisionRays = 1;

		/**
		 * Threshold to subdivide the map tiles.
		 * 
		 * Lower value will subdivide earlier (less zoom required to subdivide).
		 * 
		 * @attribute thresholdUp
		 * @type {number}
		 */
		this.thresholdUp = 0.6;

		/**
		 * Threshold to simplify the map tiles.
		 * 
		 * Higher value will simplify earlier.
		 *
		 * @attribute thresholdDown
		 * @type {number}
		 */
		this.thresholdDown = 0.15;

		this.raycaster = new Raycaster();

		this.mouse = new Vector2();

		this.vector = new Vector3();
	}

	updateLOD(view, camera, renderer, scene)
	{
		var intersects = [];
		
		for (var t = 0; t < this.subdivisionRays; t++)
		{
			// Raycast from random point
			this.mouse.set(Math.random() * 2 - 1, Math.random() * 2 - 1);
			
			// Check intersection
			this.raycaster.setFromCamera(this.mouse, camera);
			this.raycaster.intersectObjects(view.children, true, intersects);
		}

		const thresholdUp = this.thresholdUp;
		const thresholdDown = this.thresholdDown;
		
		if (view.mode === MapView.SPHERICAL)
		{
			for (var i = 0; i < intersects.length; i++)
			{
				var node = intersects[i].object;
				if (!(node instanceof MapNode)) 
				{
					continue;
				}
				const distance = Math.pow(intersects[i].distance * 2, node.level);
	
				if (distance < thresholdUp)
				{
					node.subdivide();
					return;
				}
				else if (distance > thresholdDown)
				{
					if (node.parentNode !== null)
					{
						node.parentNode.simplify();
						return;
					}
				}
			}
		}
		else // if(this.mode === MapView.PLANAR || this.mode === MapView.HEIGHT)
		{
			for (var i = 0; i < intersects.length; i++)
			{
				var node = intersects[i].object;
				var matrix = node.matrixWorld.elements;
				var scaleX = this.vector.set(matrix[0], matrix[1], matrix[2]).length();
				var value = scaleX / intersects[i].distance;
	
				if (value > thresholdUp)
				{
					node.subdivide();
					return;
				}
				else if (value < thresholdDown)
				{
					if (node.parentNode !== null)
					{
						node.parentNode.simplify();
						return;
					}
				}
			}
		}
	}
}

/**
 * Map viewer is used to read and display map tiles from a server.
 * 
 * It was designed to work with a OpenMapTiles but can also be used with another map tiles.
 *
 * The map is drawn in plane map nodes using a quad tree that is subdivided as necessary to guaratee good map quality.
 *
 * @class MapView
 * @extends {Mesh}
 * @param {string} mode Map view node modes can be SPHERICAL, HEIGHT or PLANAR. PLANAR is used by default.
 * @param {number} provider Map color tile provider by default a OSM maps provider is used if none specified.
 * @param {number} heightProvider Map height tile provider, by default no height provider is used.
 */
class MapView extends Mesh
{
	/**
	 * Planar map projection.
	 *
	 * @static
	 * @attribute PLANAR
	 * @type {number}
	 */
	static PLANAR = 200;

	/**
	 * Spherical map projection.
	 *
	 * @static
	 * @attribute SPHERICAL
	 * @type {number}
	 */
	static SPHERICAL = 201;

	/**
	 * Planar map projection with height deformation.
	 *
	 * @static
	 * @attribute HEIGHT
	 * @type {number}
	 */
	static HEIGHT = 202;

	/**
	 * Planar map projection with height deformation using the GPU for height generation.
	 *
	 * @static
	 * @attribute HEIGHT_DISPLACEMENT
	 * @type {number}
	 */
	static HEIGHT_SHADER = 203;

	constructor(mode, provider, heightProvider, onNodeReady)
	{
		mode = mode !== undefined ? mode : MapView.PLANAR;

		var geometry;

		if (mode === MapView.SPHERICAL)
		{
			geometry = new MapSphereNodeGeometry(UnitsUtils.EARTH_RADIUS, 64, 64, 0, 2 * Math.PI, 0, Math.PI);
		}
		else // if(mode === MapView.PLANAR || mode === MapView.HEIGHT)
		{
			geometry = MapPlaneNode.GEOMETRY;
		}

		super(geometry, new MeshBasicMaterial({transparent: true, opacity: 0.0}));
		
		/**
		 * Define the type of map view in use.
		 *
		 * This value can only be set on creation
		 *
		 * @attribute mode
		 * @type {number}
		 */
		this.mode = mode;

		/**
		 * LOD control object used to defined how tiles are loaded in and out of memory.
		 * 
		 * @attribute lod
		 * @type {LODControl}
		 */
		this.lod = new LODRaycast();

		/**
		 * Map tile color layer provider.
		 *
		 * @attribute provider
		 * @type {MapProvider}
		 */
		this.provider = provider !== undefined ? provider : new OpenStreetMapsProvider();

		/**
		 * Map height (terrain elevation) layer provider.
		 *
		 * @attribute heightProvider
		 * @type {MapProvider}
		 */
		this.heightProvider = heightProvider !== undefined ? heightProvider : null;


		if (onNodeReady) 
		{
			this.onNodeReady = onNodeReady;
		}

		/**
		 * Root map node.
		 *
		 * @attribute root
		 * @type {MapPlaneNode}
		 */
		this.root = null;

		if (this.mode === MapView.PLANAR)
		{
			this.scale.set(UnitsUtils.EARTH_PERIMETER, 1, UnitsUtils.EARTH_PERIMETER);
			this.root = new MapPlaneNode(null, this, MapNode$1.ROOT, 0, 0, 0);
		}
		else if (this.mode === MapView.HEIGHT)
		{
			this.scale.set(UnitsUtils.EARTH_PERIMETER, MapHeightNode.USE_DISPLACEMENT ? MapHeightNode.MAX_HEIGHT : 1, UnitsUtils.EARTH_PERIMETER);
			this.root = new MapHeightNode(null, this, MapNode$1.ROOT, 0, 0, 0);
		}
		else if (this.mode === MapView.HEIGHT_SHADER)
		{
			this.scale.set(UnitsUtils.EARTH_PERIMETER, MapHeightNode.USE_DISPLACEMENT ? MapHeightNode.MAX_HEIGHT : 1, UnitsUtils.EARTH_PERIMETER);
			this.root = new MapHeightNodeShader(null, this, MapNode$1.ROOT, 0, 0, 0);
		}
		else if (this.mode === MapView.SPHERICAL)
		{
			this.root = new MapSphereNode(null, this, MapNode$1.ROOT, 0, 0, 0);
		}
		if (this.root)
		{
			this.add(this.root);
		}
	}

	/**
	 * Change the map provider of this map view.
	 *
	 * Will discard all the tiles already loaded using the old provider.
	 *
	 * @method setProvider
	 */
	setProvider(provider)
	{
		if (provider !== this.provider)
		{
			this.provider = provider;
			this.clear();
		}
	}

	/**
	 * Change the map height provider of this map view.
	 *
	 * Will discard all the tiles already loaded using the old provider.
	 *
	 * @method setHeightProvider
	 */
	setHeightProvider(heightProvider)
	{
		if (heightProvider !== this.heightProvider)
		{
			this.heightProvider = heightProvider;
			this.clear();
		}
	}

	/**
	 * Clears all tiles from memory and reloads data. Used when changing the provider.
	 * 
	 * Should be called manually if any changed to the provider are made without setting the provider.
	 * 
	 * @method clear
	 */
	clear()
	{
		this.traverse(function(children)
		{
			if (children.childrenCache !== undefined && children.childrenCache !== null)
			{
				children.childrenCache = null;
			}

			if (children.loadTexture !== undefined)
			{
				children.loadTexture();
			}
		});
	}

	/**
	 * Ajust node configuration depending on the camera distance.
	 *
	 * Called everytime before render. 
	 *
	 * @method onBeforeRender
	 */
	onBeforeRender(renderer, scene, camera, geometry, material, group)
	{
		if (!this.onNodeReady) 
		{
			this.lod.updateLOD(this, camera, renderer, scene);
		}
	}

	onNodeReady()
	{
		
	}

	/**
	 * Get map meta data from server if supported.
	 * 
	 * @method getMetaData
	 */
	getMetaData()
	{
		this.provider.getMetaData();
	}

	/**
	 * Fetch tile image URL using its quadtree position and zoom level.
	 * 
	 * @method fetchTile
	 * @param {number} zoom Zoom level.
	 * @param {number} x Tile x.
	 * @param {number} y Tile y.
	 */
	fetchTile(zoom, x, y)
	{
		return this.provider.fetchTile(zoom, x, y);
	}

	raycast(raycaster, intersects)
	{
		return false;
	}
}

var pov$1 = new Vector3();
var position$1 = new Vector3();

/**
 * Check the planar distance between the nodes center and the view position.
 * 
 * Distance is adjusted with the node level, more consistent results since every node is considered.
 *
 * @class LODRadial
 * @extends {LODControl}
 */
class LODRadial extends LODControl
{
	constructor()
	{
		super();
	
		/**
		 * Minimum ditance to subdivide nodes.
		 *
		 * @attribute subdivideDistance
		 * @type {number}
		 */
		this.subdivideDistance = 50;
	
		/**
		 * Minimum ditance to simplify far away nodes that are subdivided.
		 *
		 * @attribute simplifyDistance
		 * @type {number}
		 */
		this.simplifyDistance = 300;
	}

	updateLOD(view, camera, renderer, scene)
	{
		var self = this;
	
		camera.getWorldPosition(pov$1);
	
		view.children[0].traverse(function(node)
		{
			if (!(node instanceof Mesh)) 
			{
				return;
			}
			node.getWorldPosition(position$1);
	
			var distance = pov$1.distanceTo(position$1);
			distance /= Math.pow(2, view.provider.maxZoom - node.level);
	
			if (distance < self.subdivideDistance)
			{
				node.subdivide();
			}
			else if (distance > self.simplifyDistance && node.parentNode)
			{
				node.parentNode.simplify();
			}
		});
	}
}

var projection = new Matrix4();
var pov = new Vector3();
var frustum = new Frustum();
var position = new Vector3();

/**
 * Check the planar distance between the nodes center and the view position.
 * 
 * Only subdivides elements inside of the camera frustum.
 *
 * @class LODFrustum
 * @extends {LODRadial}
 */
class LODFrustum extends LODRadial
{
	constructor()
	{
		super();

		this.subdivideDistance = 120;
	
		this.simplifyDistance = 400;
	
		/**
		 * If true only the central point of the plane geometry will be used
		 * 
		 * Otherwise the object bouding sphere will be tested, providing better results for nodes on frustum edge but will lower performance.
		 * 
		 * @attribute testCenter
		 * @type {boolean}
		 */
		this.testCenter = true;
	}

	handleNode(node, minZoom, maxZoom, inFrustum = false) 
	{
		if (!(node instanceof MapNode$1)) 
		{
			return;
		}
		node.getWorldPosition(position);
		var distance = pov.distanceTo(position);
		distance /= Math.pow(2, 20 - node.level);

		 inFrustum = inFrustum || (this.pointOnly ? frustum.containsPoint(position) : frustum.intersectsObject(node));
		//  console.log('handleNode', node.x, node.y, node.level, distance, inFrustum);
		 if (maxZoom > node.level && distance < this.subdivideDistance && inFrustum)
		{
			const subdivded = node.subdivide();
			if (subdivded) 
			{
				subdivded.forEach((n) => {return this.handleNode(n, minZoom, maxZoom);});
			}
		}
		else if (minZoom < node.level && distance > this.simplifyDistance && node.parentNode)
		{
			const simplified = node.parentNode.simplify();
			if (simplified && simplified.level > minZoom) 
			{
				this.handleNode(simplified, minZoom, maxZoom);
			}
		}
		else if (inFrustum && minZoom <= node.level )
		{
			if (!node.isReady) 
			{
				node.loadTexture();
			}
		}
	}

	updateLOD(view, camera, renderer, scene)
	{
		// const start = Date.now();
		projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		frustum.setFromProjectionMatrix(projection);
		camera.getWorldPosition(pov);
		
		const minZoom = view.provider.minZoom;
		const maxZoom = view.provider.maxZoom;
		const toHandle = [];
		view.children[0].traverseVisible((node) => {return toHandle.push(node);});
		toHandle.forEach((node) =>
		{		
			if (node.children.length <=1) 
			{
				this.handleNode(node, minZoom, maxZoom);
			}
		});
		// view.children[0].traverse((node) =>
		// {	
		// 	this.handleNode(node, minZoom, maxZoom);
		// });
		// console.log('updateLOD', Date.now() - start, 'ms');
	}
}

/**
 * XHR utils contains static methods to allow easy access to services via XHR.
 *
 * @static
 * @class XHRUtils
 */
class XHRUtils 
{
	/**
	 * Get file data from URL as text, using a XHR call.
	 * 
	 * @method readFile
	 * @param {string} url Target for the request.
	 * @param {Function} onLoad On load callback.
	 * @param {Function} onError On progress callback.
	 */
	static get(url, onLoad, onError)
	{
		var xhr = new XMLHttpRequest();
		xhr.overrideMimeType("text/plain");
		xhr.open("GET", url, true);

		if (onLoad !== undefined)
		{
			xhr.onload = function()
			{
				onLoad(xhr.response);
			};
		}

		if (onError !== undefined)
		{
			xhr.onerror = onError;
		}

		xhr.send(null);

		return xhr;
	}

	/**
	 * Get file data from URL , using a XHR call.
	 * 
	 * @method readFile
	 * @param {string} url Target for the request.
	 * @param {Function} onLoad On load callback.
	 * @param {Function} onError On progress callback.
	 */
	static getRaw(url, onLoad, onError)
	{
		var xhr = new XMLHttpRequest();
		xhr.responseType = "arraybuffer";
		xhr.open("GET", url, true);

		if (onLoad !== undefined)
		{
			xhr.onload = function()
			{
				onLoad(xhr.response);
			};
		}

		if (onError !== undefined)
		{
			xhr.onerror = onError;
		}

		xhr.send(null);

		return xhr;
	}

	/**
	 * Perform a request with the specified configuration.
	 * 
	 * Syncronous request should be avoided unless they are strictly necessary.
	 * 
	 * @method request
	 * @param {string} url Target for the request.
	 * @param {string} type Resquest type (POST, GET, ...)
	 * @param {string} header Object with data to be added to the request header.
	 * @param {string} body Data to be sent in the resquest.
	 * @param {Function} onLoad On load callback, receives data (String or Object) and XHR as arguments.
	 * @param {Function} onError XHR onError callback.
	 */
	static request(url, type, header, body, onLoad, onError)
	{
		function parseResponse(response)
		{
			try
			{
				return JSON.parse(response);
			}
			catch (e)
			{
				return response;
			}
		}

		var xhr = new XMLHttpRequest();
		xhr.overrideMimeType("text/plain");
		xhr.open(type, url, true);

		// Fill header data from Object
		if (header !== null && header !== undefined)
		{
			for (var i in header)
			{
				xhr.setRequestHeader(i, header[i]);
			}
		}

		if (onLoad !== undefined)
		{
			xhr.onload = function(event)
			{
				onLoad(parseResponse(xhr.response), xhr);
			};
		}

		if (onError !== undefined)
		{
			xhr.onerror = onError;
		}

		if (onProgress !== undefined)
		{
			xhr.onprogress = onProgress;
		}

		if (body !== undefined)
		{
			xhr.send(body);
		}
		else
		{
			xhr.send(null);
		}

		return xhr;
	}
}

/**
 * Bing maps tile provider.
 *
 * API Reference
 *  - https://msdn.microsoft.com/en-us/library/bb259689.aspx (Bing Maps Tile System)
 *  - https://msdn.microsoft.com/en-us/library/mt823633.aspx (Directly accessing the Bing Maps tiles)
 *  - https://www.bingmapsportal.com/
 *
 * @class BingMapsProvider
 * @param {string} apiKey Bing API key.
 */
class BingMapsProvider extends MapProvider
{
	constructor(apiKey, type)
	{
		super();

		this.maxZoom = 19;
		
		/**
		 * Server API access token.
		 * 
		 * @attribute apiKey
		 * @type {string}
		 */
		this.apiKey = apiKey !== undefined ? apiKey : "";

		/** 
		 * The type of the map used.
		 *
		 * @attribute type
		 * @type {string}
		 */
		this.type = type !== undefined ? type : BingMapsProvider.AERIAL;

		/**
		 * Map image tile format, the formats available are:
		 *  - gif: Use GIF image format.
		 *  - jpeg: Use JPEG image format. JPEG format is the default for Road, Aerial and AerialWithLabels imagery.
		 *  - png: Use PNG image format. PNG is the default format for OrdnanceSurvey imagery.
		 *
		 * @attribute format
		 * @type {string}
		 */
		this.format = "jpeg";

		/**
		 * Size of the map tiles.
		 *
		 * @attribute mapSize
		 * @type {number}
		 */
		this.mapSize = 512;

		/**
		 * Tile server subdomain.
		 *
		 * @attribute subdomain
		 * @type {string}
		 */
		this.subdomain = "t1";
	}

	/**
	 * Display an aerial view of the map.
	 *
	 * @static
	 * @attribute AERIAL
	 * @type {string}
	 */
	static AERIAL = "a";

	/**
	 * Display a road view of the map.
	 *
	 * @static
	 * @attribute AERIAL
	 * @type {string}
	 */
	static ROAD = "r";

	/**
	 * Display an aerial view of the map with labels.
	 *
	 * @static
	 * @attribute AERIAL_LABELS
	 * @type {string}
	 */
	static AERIAL_LABELS = "h";

	/**
	 * Use this value to display a bird's eye (oblique) view of the map.
	 *
	 * @static
	 * @attribute AERIAL
	 * @type {string}
	 */
	static OBLIQUE = "o";

	/**
	 * Display a bird's eye (oblique) with labels view of the map.
	 *
	 * @static
	 * @attribute AERIAL
	 * @type {string}
	 */
	static OBLIQUE_LABELS = "b";

	/** 
	 * Get the base URL for the map configuration requested.
	 *
	 * Uses the follwing format 
	 * http://ecn.{subdomain}.tiles.virtualearth.net/tiles/r{quadkey}.jpeg?g=129&mkt={culture}&shading=hill&stl=H
	 *
	 * @method getMetaData
	 */
	getMetaData()
	{
		const address = "http://dev.virtualearth.net/REST/V1/Imagery/Metadata/RoadOnDemand?output=json&include=ImageryProviders&key=" + this.apiKey;
		
		XHRUtils.get(address, function(data)
		{
			JSON.parse(data);

			// TODO <FILL METADATA>
		});
	}

	/**
	 * Convert x, y, zoom quadtree to a bing maps specific quadkey.
	 *
	 * Adapted from original C# code at https://msdn.microsoft.com/en-us/library/bb259689.aspx.
	 *
	 * @method quadKey
	 * @param {number} x
	 */
	static quadKey(zoom, x, y)
	{
		let quad = "";

		for (let i = zoom; i > 0; i--)
		{
			const mask = 1 << i - 1;
			let cell = 0;
			
			if ((x & mask) !== 0)
			{
				cell++;	
			}
			
			if ((y & mask) !== 0)
			{
				cell += 2;
			}

			quad += cell; 
		}

		return quad; 
	}

	fetchTile(zoom, x, y)
	{
		return new CancelablePromise((resolve, reject) =>
		{
			var image = document.createElement("img");
			image.onload = function() {resolve(image);};
			image.onerror = function() {reject();};
			image.crossOrigin = "Anonymous";
			image.src = "http://ecn." + this.subdomain + ".tiles.virtualearth.net/tiles/" + this.type + BingMapsProvider.quadKey(zoom, x, y) + ".jpeg?g=1173";
		});
	}
}

/**
 * Google maps tile server.
 *
 * The tile API is only available to select partners, and is not included with the Google Maps Core ServiceList.
 *
 * API Reference
 *  - https://developers.google.com/maps/documentation/javascript/coordinates
 *  - https://developers.google.com/maps/documentation/tile
 *
 * @class GoogleMapsProvider
 */
class GoogleMapsProvider extends MapProvider
{
	constructor(apiToken)
	{
		super();

		/**
		 * Server API access token.
		 * 
		 * @attribute apiToken
		 * @type {string}
		 */
		this.apiToken = apiToken !== undefined ? apiToken : "";

		/**
		 * After the first call a session token is stored.
		 *
		 * The session token is required for subsequent requests for tile and viewport information.
		 *
		 * @attribute sessionToken
		 * @type {string}
		 */
		this.sessionToken = null;

		/**
		 * The map orientation in degrees.
		 *
		 * Can be 0, 90, 180 or 270.
		 *
		 * @attribute orientation
		 * @type {number}
		 */
		this.orientation = 0;

		/**
		 * Map image tile format, the formats available are:
		 *  - png PNG
		 *  - jpg JPG
		 *
		 * @attribute format
		 * @type {string}
		 */
		this.format = "png";

		/** 
		 * The type of base map. This can be one of the following:
		 *  - roadmap: The standard Google Maps painted map tiles.
		 *  - satellite: Satellite imagery.
		 *  - terrain: Shaded relief maps of 3D terrain. When selecting terrain as the map type, you must also include the layerRoadmap layer type (described in the Optional fields section below).
		 *  - streetview: Street View panoramas. See the Street View guide.
		 *
		 * @attribute mapType
		 * @type {string}
		 */
		this.mapType = "roadmap";

		/**
		 * If true overlays are shown.
		 *
		 * @attribute overlay
		 * @type {boolean}
		 */
		this.overlay = false;

		this.createSession();
	}

	/**
	 * Create a map tile session in the maps API.
	 *
	 * This method needs to be called before using the provider
	 *
	 * @method createSession
	 */
	createSession()
	{
		const self = this;

		const address = "https://www.googleapis.com/tile/v1/createSession?key=" + this.apiToken;
		const data = JSON.stringify(
			{
				"mapType": this.mapType,
				"language": "en-EN",
				"region": "en",
				"layerTypes": ["layerRoadmap", "layerStreetview"],
				"overlay": this.overlay,
				"scale": "scaleFactor1x"
			});

		XHRUtils.request(address, "GET", {"Content-Type": "text/json"}, data, function(response, xhr)
		{
			console.log("Created google maps session.", response, xhr);
			self.sessionToken = response.session;
		},
		function(xhr)
		{
			console.warn("Unable to create a google maps session.", xhr);
		});
	}

	fetchTile(zoom, x, y)
	{
		return new CancelablePromise((resolve, reject) =>
		{
			var image = document.createElement("img");
			image.onload = function() {resolve(image);};
			image.onerror = function() {reject();};
			image.crossOrigin = "Anonymous";
			image.src = "https://www.googleapis.com/tile/v1/tiles/" + zoom + "/" + x + "/" + y + "?session=" + this.sessionToken + "&orientation=" + this.orientation + "&key=" + this.apiToken;
		});
	}
}

/**
 * Here maps tile server.
 *
 * API Reference
 *  - https://developer.here.com/documentation/map-tile/topics/example-satellite-map.html
 *
 * @class HereMapsProvider
 */
class HereMapsProvider extends MapProvider
{
	/**
	 * Path to map tile API.
	 * 
	 * Version of the api is fixed 2.1.
	 */
	static PATH = "/maptile/2.1/";
	
	/**
	 * 
	 * @param {string} appId HERE maps app id.
	 * @param {string} appCode HERE maps app code.
	 * @param {string} style Map style.
	 * @param {number} scheme Map scheme.
	 * @param {string} format Image format.
	 * @param {number} size Tile size.
	 */
	constructor(appId, appCode, style, scheme, format, size)
	{
		super();

		/**
		 * Service application access token.
		 * 
		 * @attribute appId
		 * @type {string}
		 */
		this.appId = appId !== undefined ? appId : "";

		/**
		 * Service application code token.
		 * 
		 * @attribute appCode
		 * @type {string}
		 */
		this.appCode = appCode !== undefined ? appCode : "";

		/**
		 * The type of maps to be used.
		 *  - aerial
		 *  - base
		 *  - pano
		 *  - traffic
		 * 
		 * For each type HERE maps has 4 servers:
		 *  - Aerial Tiles https://{1-4}.aerial.maps.api.here.com
		 *  - Base Map Tiles https://{1-4}.base.maps.api.here.com
		 *  - Pano Tiles https://{1-4}.pano.maps.api.here.com
		 *  - Traffic Tiles https://{1-4}.traffic.maps.api.here.com
		 *
		 * @attribute style
		 * @type {string}
		 */
		this.style = style !== undefined ? style : "base";
		
		/**
		 * Specifies the view scheme. A complete list of the supported schemes may be obtained by using the Info resouce.
		 *  - normal.day
		 *  - normal.night
		 *  - terrain.day
		 *  - satellite.day
		 *
		 * Check the scheme list at https://developer.here.com/documentation/map-tile/topics/resource-info.html
		 *
		 * Be aware that invalid combinations of schemes and tiles are rejected. For all satellite, hybrid and terrain schemes, you need to use the Aerial Tiles base URL instead of the normal one.
		 * 
		 * @attribute scheme
		 * @type {string}
		 */
		this.scheme = scheme !== undefined ? scheme : "normal.day";

		/**
		 * Map image tile format, the formats available are:
		 *  - png True color PNG
		 *  - png8 8 bit indexed PNG
		 *  - jpg JPG at 90% quality
		 *
		 * @attribute format
		 * @type {string}
		 */
		this.format = format !== undefined ? format : "png";

		/**
		 * Returned tile map image size.
		 *
		 * The following sizes are supported:
		 *  - 256
		 *  - 512
		 *  - 128 (deprecated, although usage is still accepted)
		 *
		 * @attribute size
		 * @type {number}
		 */
		this.size = size !== undefined ? size : 512;

		/**
		 * Specifies the map version, either newest or with a hash value.
		 *
		 * @attribute version
		 * @type {string}
		 */
		this.version = "newest";

		/**
		 * Server to be used next.
		 *
		 * There are 4 server available in here maps.
		 *
		 * On each request this number is updated.
		 *
		 * @attribute server
		 * @type {number}
		 */
		this.server = 1;
 	}

	/**
	 * Update the server counter.
	 *
	 * There are 4 server (1 to 4).
	 *
	 * @method nextServer
	 */
	nextServer()
	{
		this.server = this.server % 4 === 0 ? 1 : this.server + 1;
	}

	getMetaData() {}

	fetchTile(zoom, x, y)
	{
		this.nextServer();

		return new CancelablePromise((resolve, reject) =>
		{
			var image = document.createElement("img");
			image.onload = function() {resolve(image);};
			image.onerror = function() {reject();};
			image.crossOrigin = "Anonymous";
			image.src = "https://" + this.server + "." + this.style + ".maps.api.here.com/maptile/2.1/maptile/" + this.version + "/" + this.scheme + "/" + zoom + "/" + x + "/" + y + "/" + this.size + "/" + this.format + "?app_id=" + this.appId + "&app_code=" + this.appCode;
		});
	}
}

/**
 * Map box service tile provider. Map tiles can be fetched from style or from a map id.
 *
 * API Reference
 *  - https://www.mapbox.com/
 *
 * @class MapBoxProvider
 * @param {string} apiToken Map box api token.
 * @param {string} id Map style or mapID if the mode is set to MAP_ID.
 * @param {number} mode Map tile access mode.
 * @param {string} format Image format.
 * @param {boolean} useHDPI
 */
class MapBoxProvider extends MapProvider
{
	static ADDRESS = "https://api.mapbox.com/";

	/**
	 * Access the map data using a map style.
	 *
	 * @static
	 * @attribute STYLE
	 * @type {number}
	 */
	static STYLE = 100;

	/**
	 * Access the map data using a map id.
	 *
	 * @static
	 * @attribute MAP_ID
	 * @type {number}
	 */
	static MAP_ID = 101;


	constructor(apiToken, id, mode, format, useHDPI)
	{
		super();

		/**
		 * Server API access token.
		 * 
		 * @attribute apiToken
		 * @type {string}
		 */
		this.apiToken = apiToken !== undefined ? apiToken : "";

		/**
		 * Map image tile format, the formats available are:
		 *  - png True color PNG
		 *  - png32 32 color indexed PNG
		 *  - png64 64 color indexed PNG
		 *  - png128 128 color indexed PNG
		 *  - png256 256 color indexed PNG
		 *  - jpg70 70% quality JPG
		 *  - jpg80 80% quality JPG
		 *  - jpg90 90% quality JPG
		 *  - pngraw Raw png (no interpolation)
		 *
		 * @attribute format
		 * @type {string}
		 */
		this.format = format !== undefined ? format : "png";

		/**
		 * Flag to indicate if should use high resolution tiles
		 *
		 * @attribute useHDPI
		 * @type {boolean}
		 */
		this.useHDPI = useHDPI !== undefined ? useHDPI : false;

		/** 
		 * Map tile access mode
		 *  - MapBoxProvider.STYLE
		 *  - MapBoxProvider.MAP_ID
		 *
		 * @attribute mode
		 * @type {number}
		 */
		this.mode = mode !== undefined ? mode : MapBoxProvider.STYLE;

		/**
		 * Map identifier composed of {username}.{style}
		 *
		 * Some examples of the public mapbox identifiers:
		 *  - mapbox.mapbox-streets-v7
		 *  - mapbox.satellite
		 *  - mapbox.mapbox-terrain-v2
		 *  - mapbox.mapbox-traffic-v1
		 *  - mapbox.terrain-rgb
		 *
		 * @attribute mapId
		 * @type {string}
		 */
		this.mapId = id !== undefined ? id : "";

		/**
		 * Map style to be used composed of {username}/{style_id}
		 *
		 * Some example of the syles available:
		 *  - mapbox/streets-v10
		 *  - mapbox/outdoors-v10
		 *  - mapbox/light-v9
		 *  - mapbox/dark-v9
		 *  - mapbox/satellite-v9
		 *  - mapbox/satellite-streets-v10
		 *  - mapbox/navigation-preview-day-v4
		 *  - mapbox/navigation-preview-night-v4
		 *  - mapbox/navigation-guidance-day-v4
		 *  - mapbox/navigation-guidance-night-v4
		 *
		 * @attribute style
		 * @type {string}
		 */
		this.style = id !== undefined ? id : "";
	}

	getMetaData()
	{
		const self = this;
		const address = MapBoxProvider.ADDRESS + this.version + "/" + this.mapId + ".json?access_token=" + this.apiToken;

		XHRUtils.get(address, function(data)
		{
			const meta = JSON.parse(data);

			self.name = meta.name;
			self.minZoom = meta.minZoom;
			self.maxZoom = meta.maxZoom;
			self.bounds = meta.bounds;
			self.center = meta.center;
		});
	}

	fetchTile(zoom, x, y)
	{
		return new CancelablePromise((resolve, reject) =>
		{
			var image = document.createElement("img");
			image.onload = function() {resolve(image);};
			image.onerror = function() {reject();};
			image.crossOrigin = "Anonymous";

			if (this.mode === MapBoxProvider.STYLE)
			{
				image.src = MapBoxProvider.ADDRESS + "styles/v1/" + this.style + "/tiles/" + zoom + "/" + x + "/" + y + (this.useHDPI ? "@2x?access_token=" : "?access_token=") + this.apiToken;
			}
			else
			{
				image.src = MapBoxProvider.ADDRESS + "v4/" + this.mapId + "/" + zoom + "/" + x + "/" + y + (this.useHDPI ? "@2x." : ".") + this.format + "?access_token=" + this.apiToken;
			}
		});
	}
}

/**
 * Map tiler provider API.
 *
 * The map tiler server is based on open map tiles.
 *
 * API Reference
 *  - https://www.maptiler.com/
 *
 * @class MapTilerProvider
 * @param {string} apiKey
 */
class MapTilerProvider extends MapProvider
{
	constructor(apiKey, category, style, format)
	{
		super();

		/**
		 * Server API access token.
		 * 
		 * @attribute apiToken
		 * @type {string}
		 */
		this.apiKey = apiKey !== undefined ? apiKey : "";

		/**
		 * Map image tile file format (e.g png, jpg)
		 *
		 * Format can be for image or for geometry fetched from the system (e.g quantized-mesh-1.0)
		 * 
		 * @attribute format
		 * @type {string}
		 */
		this.format = format !== undefined ? format : "png";

		/**
		 * Tile category (e.g. maps, tiles), 
		 *
		 * @attribute category
		 * @type {string}
		 */
		this.category = category !== undefined ? category : "maps";

		/**
		 * Map tile type, some of the vectorial styles available.
		 * 
		 * Can be used for rasterized vectorial maps (e.g, basic, bright, darkmatter, hybrid, positron, streets, topo, voyager).
		 *
		 * Cam be used for data tiles (e.g hillshades, terrain-rgb, satellite).
		 *
		 * @attribute style
		 * @type {string}
		 */
		this.style = style !== undefined ? style : "satellite";

		this.resolution = 512;
	}

	fetchTile(zoom, x, y)
	{
		return new CancelablePromise((resolve, reject) =>
		{
			var image = document.createElement("img");
			image.onload = function() {resolve(image);};
			image.onerror = function() {reject();};
			image.crossOrigin = "Anonymous";
			image.src = "https://api.maptiler.com/" + this.category + "/" + this.style + "/" + zoom + "/" + x + "/" + y + "." + this.format + "?key=" + this.apiKey;
		});
	}
}

/**
 * Open tile map server tile provider.
 *
 * API Reference
 *  - https://openmaptiles.org/
 *
 * @class OpenMapTilesProvider
 */
class OpenMapTilesProvider extends MapProvider
{
	constructor(address)
	{
		super();

		/**
		 * Map server address.
		 *
		 * By default the open OSM tile server is used.
		 * 
		 * @attribute address
		 * @type {string}
		 */
		this.address = address;

		/**
		 * Map image tile format.
		 * 
		 * @attribute format
		 * @type {string}
		 */
		this.format = "png";

		/**
		 * Map tile theme, some of the styles available.
		 * - dark-matter
		 * - klokantech-basic
		 * - osm-bright
		 * - positron
		 * 
		 * @attribute theme
		 * @type {string}
		 */
		this.theme = "klokantech-basic";
	}

	getMetaData()
	{
		const self = this;
		const address = this.address + "styles/" + this.theme + ".json";

		XHRUtils.get(address, function(data)
		{
			const meta = JSON.parse(data);

			self.name = meta.name;
			self.format = meta.format;
			self.minZoom = meta.minZoom;
			self.maxZoom = meta.maxZoom;
			self.bounds = meta.bounds;
			self.center = meta.center;
		});
	}

	fetchTile(zoom, x, y)
	{
		return new CancelablePromise((resolve, reject) =>
		{
			var image = document.createElement("img");
			image.onload = function() {resolve(image);};
			image.onerror = function() {reject();};
			image.crossOrigin = "Anonymous";
			image.src = this.address + "styles/" + this.theme + "/" + zoom + "/" + x + "/" + y + "." + this.format;
		});
	}
}

/**
 * Debug provider can be used to debug the levels of the map three based on the zoom level they change between green and red.
 *
 * @class DebugProvider
 */
class DebugProvider extends MapProvider
{
	constructor()
	{
		super();
		
		/**
		 * Resolution in px of each tile.
		 * 
		 * @attribute resolution
		 * @type {number}
		 */
		this.resolution = 256;
	}

	fetchTile(zoom, x, y)
	{
		const canvas = new OffscreenCanvas(this.resolution, this.resolution);
		const context = canvas.getContext('2d');
		
		const green = new Color(0x00FF00);
		const red = new Color(0xFF0000);

		const color = green.lerpHSL(red, (zoom - this.minZoom) / (this.maxZoom - this.minZoom));

		context.fillStyle = color.getStyle();
		context.fillRect(0, 0, this.resolution, this.resolution);

		context.fillStyle = "#000000";
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.font = "bold " + this.resolution * 0.1 + "px arial";
		context.fillText("(" + zoom + ")", this.resolution / 2, this.resolution * 0.4);
		context.fillText("(" + x + ", " + y + ")", this.resolution / 2, this.resolution * 0.6);

		return Promise.resolve(canvas);
	}
}

/**
 * Height debug provider takes a RGB encoded height map from another provider and converts it to a gradient for preview.
 *
 * Usefull to preview and compare height of different providers. Can also be usefull to generate grayscale maps to be feed into other libraries (e.g. physics engine).
 * 
 * @class HeightDebugProvider
 */
class HeightDebugProvider extends MapProvider
{
	constructor(provider)
	{
		super();

		/**
		 * The provider used to retrieve the base RGB information to be debugged.
		 * 
		 * @attribute provider
		 * @type {MapProvider}
		 */
		this.provider = provider;

		/**
		 * Initial color to be used for lower values.
		 * 
		 * @attribute fromColor
		 * @type {Color}
		 */
		this.fromColor = new Color(0xFF0000);

		/**
		 * Final color to be used for higher values.
		 * 
		 * @attribute toColor
		 * @type {Color}
		 */
		this.toColor = new Color(0x00FF00);
	}

	fetchTile(zoom, x, y)
	{
		return new CancelablePromise((resolve, reject) =>
		{
			this.provider.fetchTile(zoom, x, y).then((image) =>
			{
				const resolution = 256;

				const canvas = new OffscreenCanvas(resolution, resolution);
				const context = canvas.getContext('2d');
				
				context.drawImage(image, 0, 0, resolution, resolution, 0, 0, resolution, resolution);
		
				var imageData = context.getImageData(0, 0, resolution, resolution);
				var data = imageData.data;
				for (var i = 0; i < data.length; i += 4)
				{
					var r = data[i];
					var g = data[i + 1];
					var b = data[i + 2];
		
					// The value will be composed of the bits RGB
					var value = (r * 65536 + g * 256 + b) * 0.1 - 1e4;
					
					// (16777216 * 0.1) - 1e4
					var max = 1667721.6;

					const color = this.fromColor.clone().lerpHSL(this.toColor, value / max);

					// Set pixel color
					data[i] = color.r * 255;
					data[i + 1] = color.g * 255;
					data[i + 2] = color.b * 255;
				}
		
				context.putImageData(imageData, 0, 0);

				resolve(canvas);
			}).catch(reject);
		});

	}
}

class Martini 
{
	constructor(gridSize = 257) 
	{
		this.gridSize = gridSize;
		const tileSize = gridSize - 1;
		if (tileSize & tileSize - 1) 
		{
			throw new Error(
				`Expected grid size to be 2^n+1, got ${gridSize}.`);
		}

		this.numTriangles = tileSize * tileSize * 2 - 2;
		this.numParentTriangles = this.numTriangles - tileSize * tileSize;

		this.indices = new Uint32Array(this.gridSize * this.gridSize);

		// coordinates for all possible triangles in an RTIN tile
		this.coords = new Uint16Array(this.numTriangles * 4);

		// get triangle coordinates from its index in an implicit binary tree
		for (let i = 0; i < this.numTriangles; i++) 
		{
			let id = i + 2;
			let ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0;
			if (id & 1) 
			{
				bx = by = cx = tileSize; // bottom-left triangle
			}
			else 
			{
				ax = ay = cy = tileSize; // top-right triangle
			}
			while ((id >>= 1) > 1) 
			{
				const mx = ax + bx >> 1;
				const my = ay + by >> 1;

				if (id & 1) 
				{ // left half
					bx = ax; by = ay;
					ax = cx; ay = cy;
				}
				else 
				{ // right half
					ax = bx; ay = by;
					bx = cx; by = cy;
				}
				cx = mx; cy = my;
			}
			const k = i * 4;
			this.coords[k + 0] = ax;
			this.coords[k + 1] = ay;
			this.coords[k + 2] = bx;
			this.coords[k + 3] = by;
		}
	}

	createTile(terrain) 
	{
		return new Tile(terrain, this);
	}
}

class Tile 
{
	constructor(terrain, martini) 
	{
		const size = martini.gridSize;
		if (terrain.length !== size * size) 
		{
			throw new Error(
				`Expected terrain data of length ${size * size} (${size} x ${size}), got ${terrain.length}.`);
		}

		this.terrain = terrain;
		this.martini = martini;
		this.errors = new Float32Array(terrain.length);
		this.update();
	}

	update() 
	{
		const {numTriangles, numParentTriangles, coords, gridSize: size} = this.martini;
		const {terrain, errors} = this;

		// iterate over all possible triangles, starting from the smallest level
		for (let i = numTriangles - 1; i >= 0; i--) 
		{
			const k = i * 4;
			const ax = coords[k + 0];
			const ay = coords[k + 1];
			const bx = coords[k + 2];
			const by = coords[k + 3];
			const mx = ax + bx >> 1;
			const my = ay + by >> 1;
			const cx = mx + my - ay;
			const cy = my + ax - mx;

			// calculate error in the middle of the long edge of the triangle
			const interpolatedHeight = (terrain[ay * size + ax] + terrain[by * size + bx]) / 2;
			const middleIndex = my * size + mx;
			const middleError = Math.abs(interpolatedHeight - terrain[middleIndex]);

			errors[middleIndex] = Math.max(errors[middleIndex], middleError);

			if (i < numParentTriangles) 
			{ // bigger triangles; accumulate error with children
				const leftChildIndex = (ay + cy >> 1) * size + (ax + cx >> 1);
				const rightChildIndex = (by + cy >> 1) * size + (bx + cx >> 1);
				errors[middleIndex] = Math.max(errors[middleIndex], errors[leftChildIndex], errors[rightChildIndex]);
			}
		}
	}

	getMesh(maxError = 0, withSkirts = false) 
	{
		const {gridSize: size, indices} = this.martini;
		const {errors} = this;
		let numVertices = 0;
		let numTriangles = 0;
		const max = size - 1;
		let aIndex, bIndex, cIndex = 0;
		// Skirt indices
		const leftSkirtIndices = [];
		const rightSkirtIndices = [];
		const bottomSkirtIndices = [];
		const topSkirtIndices = [];
		// use an index grid to keep track of vertices that were already used to avoid duplication
		indices.fill(0);

		// retrieve mesh in two stages that both traverse the error map:
		// - countElements: find used vertices (and assign each an index), and count triangles (for minimum allocation)
		// - processTriangle: fill the allocated vertices & triangles typed arrays
		function countElements(ax, ay, bx, by, cx, cy) 
		{
			const mx = ax + bx >> 1;
			const my = ay + by >> 1;

			if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && errors[my * size + mx] > maxError) 
			{
				countElements(cx, cy, ax, ay, mx, my);
				countElements(bx, by, cx, cy, mx, my);
			}
			else 
			{
				aIndex = ay * size + ax;
				bIndex = by * size + bx;
				cIndex = cy * size + cx;

				if (indices[aIndex] === 0) 
				{
					if (withSkirts) 
					{
						if (ax === 0) 
						{
							leftSkirtIndices.push(numVertices);
						}
						else if (ax === max)
						{
							rightSkirtIndices.push(numVertices);
						} if (ay === 0) 
						{
							bottomSkirtIndices.push(numVertices);
						}
						else if (ay === max) 
						{
							topSkirtIndices.push(numVertices);
						}
					}
                    
					indices[aIndex] = ++numVertices;
				}
				if (indices[bIndex] === 0) 
				{
					if (withSkirts) 
					{
						if (bx === 0) 
						{
							leftSkirtIndices.push(numVertices);
						}
						else if (bx === max) 
						{
							rightSkirtIndices.push(numVertices);
						} if (by === 0) 
						{
							bottomSkirtIndices.push(numVertices);
						}
						else if (by === max) 
						{
							topSkirtIndices.push(numVertices);
						}
					}
					indices[bIndex] = ++numVertices;
				}
				if (indices[cIndex] === 0) 
				{
					if (withSkirts) 
					{
						if (cx === 0) 
						{
							leftSkirtIndices.push(numVertices);
						}
						else if (cx === max) 
						{
							rightSkirtIndices.push(numVertices);
						} if (cy === 0) 
						{
							bottomSkirtIndices.push(numVertices);
						}
						else if (cy === max) 
						{
							topSkirtIndices.push(numVertices);
						}
					}
					indices[cIndex] = ++numVertices;
				}
				numTriangles++;
			}
		}
		countElements(0, 0, max, max, max, 0);
		countElements(max, max, 0, 0, 0, max);

		let numTotalVertices =numVertices * 2;
		let numTotalTriangles = numTriangles * 3 ;
		if (withSkirts) 
		{
			numTotalVertices +=(leftSkirtIndices.length +
                    rightSkirtIndices.length +
                    bottomSkirtIndices.length +
                    topSkirtIndices.length) * 2;
			numTotalTriangles += (
				(leftSkirtIndices.length - 1) * 2 +
                    (rightSkirtIndices.length - 1) * 2 +
                    (bottomSkirtIndices.length - 1) * 2 +
                    (topSkirtIndices.length - 1) * 2) * 3;
		}

		const vertices = new Uint16Array(numTotalVertices);
		const triangles = new Uint32Array(numTotalTriangles);

		let triIndex = 0;
		function processTriangle(ax, ay, bx, by, cx, cy) 
		{
			const mx = ax + bx >> 1;
			const my = ay + by >> 1;

			if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && errors[my * size + mx] > maxError) 
			{
				// triangle doesn't approximate the surface well enough; drill down further
				processTriangle(cx, cy, ax, ay, mx, my);
				processTriangle(bx, by, cx, cy, mx, my);

			}
			else 
			{
				// add a triangle
				const a = indices[ay * size + ax] - 1;
				const b = indices[by * size + bx] - 1;
				const c = indices[cy * size + cx] - 1;

				vertices[2 * a] = ax;
				vertices[2 * a + 1] = ay;

				vertices[2 * b] = bx;
				vertices[2 * b + 1] = by;

				vertices[2 * c] = cx;
				vertices[2 * c + 1] = cy;
				triangles[triIndex++] = a;
				triangles[triIndex++] = b;
				triangles[triIndex++] = c;
			}
		}
		processTriangle(0, 0, max, max, max, 0);
		processTriangle(max, max, 0, 0, 0, max);
		if (withSkirts) 
		{
			// Sort skirt indices to create adjacent triangles
			leftSkirtIndices.sort((a, b) => {return vertices[2 * a + 1] - vertices[2 * b + 1];});

			// Reverse (b - a) to match triangle winding
			rightSkirtIndices.sort((a, b) => {return vertices[2 * b + 1] - vertices[2 * a + 1];});

			bottomSkirtIndices.sort((a, b) => {return vertices[2 * b] - vertices[2 * a];});

			// Reverse (b - a) to match triangle winding
			topSkirtIndices.sort((a, b) => {return vertices[2 * a] - vertices[2 * b];});

			let skirtIndex = numVertices * 2;
			let currIndex, nextIndex, currentSkirt, nextSkirt, skirtLength = 0;

			// Add skirt vertices from index of last mesh vertex
			function constructSkirt(skirt) 
			{
				skirtLength = skirt.length;
				// Loop through indices in groups of two to generate triangles
				for (let i = 0; i < skirtLength - 1; i++) 
				{
					currIndex = skirt[i];
					nextIndex = skirt[i + 1];
					currentSkirt = skirtIndex / 2;
					nextSkirt = (skirtIndex + 2) / 2;
					vertices[skirtIndex++] = vertices[2 * currIndex];
					vertices[skirtIndex++] = vertices[2 * currIndex + 1];

					triangles[triIndex++] = currIndex;
					triangles[triIndex++] = currentSkirt;
					triangles[triIndex++] = nextIndex;

					triangles[triIndex++] = currentSkirt;
					triangles[triIndex++] = nextSkirt;
					triangles[triIndex++] = nextIndex;
				}
				// Add vertices of last skirt not added above (i < skirtLength - 1)
				vertices[skirtIndex++] = vertices[2 * skirt[skirtLength - 1]];
				vertices[skirtIndex++] = vertices[2 * skirt[skirtLength - 1] + 1];
			}

			constructSkirt(leftSkirtIndices);
			constructSkirt(rightSkirtIndices);
			constructSkirt(bottomSkirtIndices);
			constructSkirt(topSkirtIndices);
		}

 
		// Return vertices and triangles and index into vertices array where skirts start
		return {vertices: vertices, triangles: triangles, numVerticesWithoutSkirts: numVertices};
	}
}

function getTerrain(imageData, tileSize, elevationDecoder) 
{
	const {rScaler, bScaler, gScaler, offset} = elevationDecoder;
  
	const gridSize = tileSize + 1;
	// From Martini demo
	// https://observablehq.com/@mourner/martin-real-time-rtin-terrain-mesh
	const terrain = new Float32Array(gridSize * gridSize);
	// decode terrain values
	for (let i = 0, y = 0; y < tileSize; y++) 
	{
	  for (let x = 0; x < tileSize; x++, i++) 
		{
			const k = i * 4;
			const r = imageData[k + 0];
			const g = imageData[k + 1];
			const b = imageData[k + 2];
			terrain[i + y] = r * rScaler + g * gScaler + b * bScaler + offset;
	  }
	}
	// backfill bottom border
	for (let i = gridSize * (gridSize - 1), x = 0; x < gridSize - 1; x++, i++) 
	{
	  terrain[i] = terrain[i - gridSize];
	}
	// backfill right border
	for (let i = gridSize - 1, y = 0; y < gridSize; y++, i += gridSize) 
	{
	  terrain[i] = terrain[i - 1];
	}
	return terrain;
}

function getMeshAttributes(vertices, terrain, tileSize, bounds, exageration) 
{
	const gridSize = tileSize + 1;
	const numOfVerticies = vertices.length / 2;
	// vec3. x, y in pixels, z in meters
	const positions = new Float32Array(numOfVerticies * 3);
	// vec2. 1 to 1 relationship with position. represents the uv on the texture image. 0,0 to 1,1.
	const texCoords = new Float32Array(numOfVerticies * 2);
  
	const [minX, minY, maxX, maxY] = bounds || [0, 0, tileSize, tileSize];
	const xScale = (maxX - minX) / tileSize;
	const yScale = (maxY - minY) / tileSize;
  
	for (let i = 0; i < numOfVerticies; i++) 
	{
	  const x = vertices[i * 2];
	  const y = vertices[i * 2 + 1];
	  const pixelIdx = y * gridSize + x;
  
	  positions[3 * i + 0] = x * xScale + minX;
	  positions[3 * i + 1] = -terrain[pixelIdx] * exageration;
	  positions[3 * i + 2] = -y * yScale + maxY;

  
	  texCoords[2 * i + 0] = x / tileSize;
	  texCoords[2 * i + 1] = y / tileSize;
	}
  
	return {
	  position: {value: positions, size: 3},
	  uv: {value: texCoords, size: 2}
	  // NORMAL: {}, - optional, but creates the high poly look with lighting
	};
}

/** 
 * Represents a height map tile node that can be subdivided into other height nodes.
 * 
 * Its important to update match the height of the tile with the neighbors nodes edge heights to ensure proper continuity of the surface.
 * 
 * The height node is designed to use MapBox elevation tile encoded data as described in https://www.mapbox.com/help/access-elevation-data/
 *
 * @class MapHeightNode
 * @param parentNode {MapHeightNode} The parent node of this node.
 * @param mapView {MapView} Map view object where this node is placed.
 * @param location {number} Position in the node tree relative to the parent.
 * @param level {number} Zoom level in the tile tree of the node.
 * @param x {number} X position of the node in the tile tree.
 * @param y {number} Y position of the node in the tile tree.
 * @param material {Material} Material used to render this height node.
 * @param geometry {Geometry} Geometry used to render this height node.
 */
class MapMartiniHeightNode extends MapNode$1
{
	static GEOMETRY_SIZE = 16;

	static GEOMETRY = new MapNodeGeometry(1, 1, MapMartiniHeightNode.GEOMETRY_SIZE, MapMartiniHeightNode.GEOMETRY_SIZE);

	static prepareMaterial(material, level, exageration) 
	{
		material.userData = {
			heightMap: {value: MaterialHeightShader.EMPTY_TEXTURE},
			drawNormals: {value: 1},
			zoomlevel: {value: level},
			exageration: {value: exageration}
		};

		material.onBeforeCompile = (shader) => 
		{
			// Pass uniforms from userData to the
			for (let i in material.userData) 
			{
				shader.uniforms[i] = material.userData[i];
			}
			// Vertex variables
			shader.vertexShader =
				`
				uniform bool drawNormals;
				uniform float exageration;
				uniform float zoomlevel;
				uniform sampler2D heightMap;
				float getElevation(vec2 coord, float bias) {
					// Convert encoded elevation value to meters
					coord = clamp(coord, 0.0, 1.0);
					vec4 e = texture2D(heightMap,vec2(coord.x, 1.0 -coord.y));
					return (((e.r * 255.0 * 65536.0 + e.g * 255.0 * 256.0 + e.b * 255.0) * 0.1) - 10000.0) * exageration;
					// return ((e.r * 255.0 * 256.0 + e.g  * 255.0+ e.b * 255.0 / 256.0) - 32768.0) * exageration;
				}
				` + shader.vertexShader;
			shader.fragmentShader =
				`
				uniform bool drawNormals;
				` + shader.fragmentShader;

			// Vertex depth logic
			shader.fragmentShader = shader.fragmentShader.replace(
				"#include <dithering_fragment>",
				`
					if(drawNormals) {
						gl_FragColor = vec4( ( 0.5 * vNormal + 0.5 ), 1.0 );
					}
					`
			);
			shader.vertexShader = shader.vertexShader.replace(
				"#include <fog_vertex>",
				`
					#include <fog_vertex>

					// queried pixels:
					// +-----------+
					// |   |   |   |
					// | a | b | c |
					// |   |   |   |
					// +-----------+
					// |   |   |   |
					// | d | e | f |
					// |   |   |   |
					// +-----------+
					// |   |   |   |
					// | g | h | i |
					// |   |   |   |
					// +-----------+

					// vec4 theight = texture2D(heightMap, vUv);
					float e = getElevation(vUv, 0.0);
					if (drawNormals) {
						ivec2 size = textureSize(heightMap, 0);
						float offset = 1.0 / float(size.x);
						float a = getElevation(vUv + vec2(-offset, -offset), 0.0);
						float b = getElevation(vUv + vec2(0, -offset), 0.0);
						float c = getElevation(vUv + vec2(offset, -offset), 0.0);
						float d = getElevation(vUv + vec2(-offset, 0), 0.0);
						float f = getElevation(vUv + vec2(offset, 0), 0.0);
						float g = getElevation(vUv + vec2(-offset, offset), 0.0);
						float h = getElevation(vUv + vec2(0, offset), 0.0);
						float i = getElevation(vUv + vec2(offset,offset), 0.0);


						float NormalLength = 500.0 / zoomlevel;

						vec3 v0 = vec3(0.0, 0.0, 0.0);
						vec3 v1 = vec3(0.0, NormalLength, 0.0);
						vec3 v2 = vec3(NormalLength, 0.0, 0.0);
						v0.z = (e + d + g + h) / 4.0;
						v1.z = (e+ b + a + d) / 4.0;
						v2.z = (e+ h + i + f) / 4.0;
						vNormal = (normalize(cross(v2 - v0, v1 - v0)));
					}

					vec3 _transformed = position + e * normal;
					vec3 worldNormal = normalize ( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );

					// gl_Position = projectionMatrix * modelViewMatrix * vec4(_transformed, 1.0);
					// gl_Position = projectionMatrix * modelViewMatrix * vec4(position.yzx, 1.0);
					`
			);
		};

		return material;
	}
	
	constructor(parentNode, mapView, location, level, x, y, material, {elevationDecoder, meshMaxError, exageration} = {})
	{
		if (material === undefined)
		{
			 material = new THREE.MeshPhongMaterial({
				map: MaterialHeightShader.EMPTY_TEXTURE,
				color: 0xffffff
				// wireframe: true,
			});
			// material = new MeshPhongMaterial(
			// 	{
			// 		color: 0x000000,
			// 		specular: 0x000000,
			// 		shininess: 0,
			// 		wireframe: false,
			// 		emissive: 0xFFFFFF
			// 	});
		}
	
		super(MapMartiniHeightNode.GEOMETRY, material, parentNode, mapView, location, level, x, y);
	
		this.matrixAutoUpdate = false;
		this.isMesh = true;
		
		/**
		 * Flag indicating if the tile texture was loaded.
		 * 
		 * @attribute textureLoaded
		 * @type {boolean}
		 */
		this.textureLoaded = false;
	
		/**
		 * Flag indicating if the tile height data was loaded.
		 * 
		 * @attribute heightLoaded
		 * @type {boolean}
		 */
		this.heightLoaded = false;


		if (elevationDecoder) 
		{
			this.elevationDecoder = elevationDecoder;
		}
		else 
		{
			this.elevationDecoder = {
				rScaler: 6553.6,
				gScaler: 25.6,
				bScaler: 0.1,
				offset: -10000
			};
		}
		if (meshMaxError) 
		{
			this.meshMaxError = meshMaxError;
		}
		else 
		{
			this.meshMaxError = 10;
		}
		if (exageration) 
		{
			this.exageration = exageration;
		}
		else 
		{
			this.exageration = 1.4;
		}
		MapMartiniHeightNode.prepareMaterial(
			material,
			this.level,
			this.exageration
		);
	
		if (this.isReady) 
		{
			this.loadTexture();
		}
	}
	
	/**
	 * Original tile size of the images retrieved from the height provider.
	 *
	 * @static
	 * @attribute TILE_SIZE
	 * @type {number}
	 */
	static TILE_SIZE = 256;
	
	 /**
	 * Load tile texture from the server.
	 * 
	 * Aditionally in this height node it loads elevation data from the height provider and generate the appropiate maps.
	 *
	 * @method loadTexture
	 */
	 loadTexture()
	 {
		this.isReady = true;
		var self = this;
	
	 	this.mapView.fetchTile(this.level, this.x, this.y).then(function(image)
	 	{
			if (image) 
			{
				var texture = new Texture(image);
				texture.generateMipmaps = false;
				texture.format = RGBFormat;
				texture.magFilter = LinearFilter;
				texture.minFilter = LinearFilter;
				texture.needsUpdate = true;
			
	 			self.material.emissiveMap = texture;
		 }
	
	 	}).finally(() => 
		{
			self.textureLoaded = true;
			self.nodeReady();
		 });
	
	 	this.loadHeightGeometry();
	 };
	
	 nodeReady()
	 {
	 	if (!this.heightLoaded || !this.textureLoaded)
	 	{
	 		return;
	 	}
	
	 	this.visible = true;
	
	 	MapNode$1.prototype.nodeReady.call(this);
	 	this.mapView.onNodeReady();
	 };
	
	 createChildNodes()
	 {
	 	var level = this.level + 1;
	
	 	var x = this.x * 2;
	 	var y = this.y * 2;

	 	var node = new this.constructor(this, this.mapView, MapNode$1.TOP_LEFT, level, x, y, undefined, this);
	 	node.scale.set(0.5, 1, 0.5);
	 	node.position.set(-0.25, 0, -0.25);
	 	this.add(node);
	 	node.updateMatrix();
	 	node.updateMatrixWorld(true);
	
	 	var node = new this.constructor(this, this.mapView, MapNode$1.TOP_RIGHT, level, x + 1, y, undefined, this);
	 	node.scale.set(0.5, 1, 0.5);
	 	node.position.set(0.25, 0, -0.25);
	 	this.add(node);
	 	node.updateMatrix();
	 	node.updateMatrixWorld(true);
	
	 	var node = new this.constructor(this, this.mapView, MapNode$1.BOTTOM_LEFT, level, x, y + 1, undefined, this);
	 	node.scale.set(0.5, 1, 0.5);
	 	node.position.set(-0.25, 0, 0.25);
	 	this.add(node);
	 	node.updateMatrix();
	 	node.updateMatrixWorld(true);
	
	 	var node = new this.constructor(this, this.mapView, MapNode$1.BOTTOM_RIGHT, level, x + 1, y + 1, undefined, this);
	 	node.scale.set(0.5, 1, 0.5);
	 	node.position.set(0.25, 0, 0.25);
	 	this.add(node);
	 	node.updateMatrix();
	 	node.updateMatrixWorld(true);

	 };


	async onHeightImage(image) 
	{
		if (image) 
		{
			const tileSize = image.width;
			const gridSize = tileSize + 1;
			var canvas = new OffscreenCanvas(tileSize, tileSize);
	
			var context = canvas.getContext("2d");
			context.imageSmoothingEnabled = false;
			context.drawImage(image, 0, 0, tileSize, tileSize, 0, 0, canvas.width, canvas.height);
			
			var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
			var data = imageData.data;

			const terrain = getTerrain(data, tileSize, this.elevationDecoder);
			const martini = new Martini(gridSize);
			const tile = martini.createTile(terrain);
			const {vertices, triangles} = tile.getMesh(typeof this.meshMaxError === 'function' ? this.meshMaxError(this.level) : this.meshMaxError);
			const attributes = getMeshAttributes(vertices, terrain, tileSize, [-0.5, -0.5, 0.5, 0.5], this.exageration);
			this.geometry = new THREE.BufferGeometry();
			this.geometry.setIndex(new THREE.Uint32BufferAttribute(triangles, 1));
			this.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( attributes.position.value, attributes.position.size ) );
			this.geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( attributes.uv.value, attributes.uv.size ) );
			this.geometry.rotateX(Math.PI);

			var texture = new THREE.Texture(image);
			texture.generateMipmaps = false;
			texture.format = THREE.RGBFormat;
			texture.magFilter = THREE.NearestFilter;
			texture.minFilter = THREE.NearestFilter;
			texture.needsUpdate = true;
			this.material.userData.heightMap.value = texture;
		}
	 }
	
	 /** 
	 * Load height texture from the server and create a geometry to match it.
	 *
	 * @method loadHeightGeometry
	 * @return {Promise<void>} Returns a promise indicating when the geometry generation has finished. 
	 */
	 loadHeightGeometry()
	 {
	 	if (this.mapView.heightProvider === null)
	 	{
	 		throw new Error("GeoThree: MapView.heightProvider provider is null.");
	 	}
		
	 	this.mapView.heightProvider.fetchTile(this.level, this.x, this.y).then((image) =>
	 	{	
			return this.onHeightImage(image);
	 	}).finally(() => 
		 {
			this.heightLoaded = true;
			this.nodeReady();
		  });
	 };
	
	 /**
	 * Overrides normal raycasting, to avoid raycasting when isMesh is set to false.
	 * 
	 * @method raycast
	 */
	 raycast(raycaster, intersects)
	 {
	 	if (this.isMesh === true)
	 	{
	 		return Mesh.prototype.raycast.call(this, raycaster, intersects);
	 	}
	
	 	return false;
	 };
}

export { BingMapsProvider, CancelablePromise, DebugProvider, GoogleMapsProvider, HeightDebugProvider, HereMapsProvider, LODControl, LODFrustum, LODRadial, LODRaycast, MapBoxProvider, MapHeightNode, MapHeightNodeShader, MapMartiniHeightNode, MapNode$1 as MapNode, MapNodeGeometry, MapPlaneNode, MapProvider, MapSphereNode, MapSphereNodeGeometry, MapTilerProvider, MapView, OpenMapTilesProvider, OpenStreetMapsProvider, UnitsUtils, XHRUtils };
