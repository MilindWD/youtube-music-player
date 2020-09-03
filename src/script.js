const request = require('request');
const durationFns = require('duration-fns');

const state = {
    playlist: [],
    APIKEY : YOUR_YOUTUBE_API_KEY,
    DOM : {
        searchIcon: document.querySelector('.search-icon'),
        searchBox: document.querySelector('.search-box'),
        thumbnail: document.querySelector('.music-thumbnail--img-wrap'),
        songInfo: document.querySelector('.song-info--title'),
        playIcon: document.querySelector('.play-icon'),
        playPlay: document.querySelector('#play-play'),
        qSongsWrapper: document.querySelector('.q-songs-wrapper'),
        playBack: document.querySelector('#play-back'),
        playForward: document.querySelector('#play-forward'),
    },
    images: {
        play: ['./play1.png', './pause.png'],
    }
}

const Model = ( () => {
    return{
        extract: (value,song) => {
            song.id =  value.items[0].id.videoId;
            song.title = value.items[0].snippet.title;
            song.channel = value.items[0].snippet.channelTitle;
            song.thumbnail = value.items[0].snippet.thumbnails.high.url;
            song.loaded =  false;
        },
        
        togglePlayState : (reset=false) => {
            if(reset){
                state.currentSong.mp3.pause();
                state.playing = false;
                return;
            }
            if(!state.playing){
                state.currentSong.mp3.play();
                state.playing = true;
            }
            else{
                state.currentSong.mp3.pause();
                state.playing = false;
            }
        },

        makeCurrent: (i, click=true) => {
            state.currentSong = state.playlist[i];
            state.currentLoaded = true;
            if(click) state.DOM.playPlay.click();
        }
    }
})();

const View = ( () => {
    const changeThumbnail = (thumbURL) => {
        state.DOM.thumbnail.style.background = `url('${thumbURL}') center / cover`;
    }
    const changeTitle = (title) => {
        state.DOM.songInfo.innerHTML = title;
    }
    return{
        
        startLoad: () => {
            state.DOM.playIcon.src= './loading.gif';
            state.DOM.playIcon.style.transform = 'translateX(0)';
        },
        togglePlayIcon: (loading=false) => {
            if(loading){
                state.DOM.playIcon.src = state.images.play[0];
                state.DOM.playIcon.style.transform = 'translateX(0.5vmin)';
                return;
            }
            state.DOM.playIcon.src = state.images.play[state.playing?1:0];
            if(state.playing) document.querySelector(`[id = "${state.playingNow}"] .q-song-thumb`).style.background = "url('./miniPlay.gif') center / cover";
            if(!state.playing) document.querySelector(`[id = "${state.playingNow}"] .q-song-thumb`).style.background = "url('./miniPlayFreeze.jpg') center / cover";
        },
        addToQ: (ind) => {
            var format=state.playlist[ind].title;
            if(state.playlist[ind].title.length>35){
                format = state.playlist[ind].title.substring(0,35)+"...";
            }
            const markup = `<div class="q-song" id="${ind}">
                <div class="q-song-thumb" style="background: url('./loadingQ.gif') center / cover;"></div>
                <div class="q-song-title">${format}</div>
            </div>`;
            state.DOM.qSongsWrapper.insertAdjacentHTML('beforeend', markup);

        },
        makeCurrent : (i) => {
            changeThumbnail(state.playlist[i].thumbnail);
            changeTitle(state.playlist[i].title);
            state.playingNow = i;
        },
        changeThumbnailQ: (i, url, reset=true) => {
            document.querySelector(`[id = "${i}"] .q-song-thumb`).style.background = `url('${url}') center / cover`;
            if(state.currentSong.mp3){
                if(reset) state.currentSong.mp3.currentTime = 0;
            }
        },
        playCurrent: () => {
            state.DOM.playIcon.src = state.images.play[1];
            state.DOM.playIcon.style.transform = 'translateX(0.5vmin)';
        }
    }
})();

//async functions
const Async = ((model, view)=> {

    const loadSongMP3 = (i) => {
        const id = state.playlist[i].id;
        request({url: `https://api.sathvikks.com/api/?ID=${id}&trial=1`}, (e,r) => {
            state.playlist[i].mp3 = new Audio(`https://api.sathvikks.com/mp3/${id}.mp3`);
            view.changeThumbnailQ(i, state.playlist[i].thumbnail, false);
            state.playlist[i].loaded = true;
            if(i===state.playlist.indexOf(state.currentSong)){
                view.togglePlayIcon(true);
                model.togglePlayState(true);
                model.makeCurrent(i);
            }
            state.playlist[i].mp3.onended = function() {
                view.togglePlayIcon(true);
                model.togglePlayState(true);
                if(!(i===state.playlist.length-1)){
                    view.makeCurrent(i+1);
                    if(!state.playlist[i+1].loaded){
                        view.startLoad();
                        model.makeCurrent(i+1, false);
                    }
                    else model.makeCurrent(i+1);
                }
                view.changeThumbnailQ(i, state.playlist[i].thumbnail);
            };
            setTimeout(() => {
                request({url : `https://api.sathvikks.com/api/?ID=${id}&del=1&trial=1`}, (e,r)=>{
                    console.log('deleted');
                });
                
            }, 60000);
        });
    }

    return{
        addSong : (query) => {
            let song = {};
            request({
                    url: `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${query}&key=${state.APIKEY}`,
                    json: true 
                }, (error, response) => {
                    console.log(response.body);
                    model.extract(response.body,song);
                    request({url: `https://www.googleapis.com/youtube/v3/videos?id=${song.id}&part=contentDetails&key=${state.APIKEY}`, json: true}, (error,response) => {
                        if(durationFns.toSeconds(response.body.items[0].contentDetails.duration)>900){
                            alert('song duration more than 15 minutes cannot add to queue');
                            if(state.playlist.length===0){
                                view.togglePlayIcon(true);
                            }
                            return;
                        }
                        state.playlist.push(song);
                        if(state.playlist.length===1){
                            state.currentSong = state.playlist[0];
                            view.makeCurrent(0);

                        }
                        view.addToQ(state.playlist.length-1);
                        loadSongMP3(state.playlist.length-1);
                    });
                    // console.log(state.playlist);
                }
            );
        },
        
    }

    
})(Model, View);


const Control = ( (model, view, async) => {
    const addSong = () => {
        if(state.playlist.length===0){
            view.startLoad();
        }
        const query = state.DOM.searchBox.value;
        if(query==='') return;
        state.DOM.searchBox.value='';
        async.addSong(query);
    }

    const setupEventListeners = () => {
        state.DOM.searchIcon.addEventListener('click', () => {
            addSong();
        });
        document.querySelector('input').addEventListener("keyup", (event) => {
            if (event.keyCode === 13) {
              event.preventDefault();
              addSong();
            }
          });
        state.DOM.playPlay.addEventListener('click', () => {
            if(!state.currentLoaded) return;
            model.togglePlayState();
            view.togglePlayIcon();
        });
        state.DOM.playBack.addEventListener('click', () => {
            const i =state.playlist.indexOf(state.currentSong);
            if(!state.playlist[i].loaded){
                return;
            } 

            if(state.currentSong.id && i>0){
                view.togglePlayIcon(true);
                model.togglePlayState(true);
                view.makeCurrent(i-1);
                model.makeCurrent(i-1);
                view.changeThumbnailQ(i, state.playlist[i].thumbnail);
            }
        });
        state.DOM.playForward.addEventListener('click', () => {
            const i = state.playlist.indexOf(state.currentSong);
            if(!state.playlist[i].loaded){
                return;
            } 
            if(state.currentSong.id && i<state.playlist.length-1){
                view.togglePlayIcon(true);
                model.togglePlayState(true);
                view.makeCurrent(i+1);
                model.makeCurrent(i+1);
                if(!state.playlist[i+1].loaded){
                    view.startLoad();
                    model.makeCurrent(i+1, false);
                }
                view.changeThumbnailQ(i, state.playlist[i].thumbnail);
            }
        });
        state.DOM.qSongsWrapper.addEventListener('click', (e) => {
            if(!e.path[1].id) return;
            const jump = parseInt(e.path[1].id);
            console.log(jump);
            const i = state.playlist.indexOf(state.currentSong);
            view.togglePlayIcon(true);
            model.togglePlayState(true);
            view.makeCurrent(jump);
            model.makeCurrent(jump);
            if(!state.playlist[jump].loaded){
                view.startLoad();
                model.makeCurrent(jump, false);
            }
            view.changeThumbnailQ(i, state.playlist[i].thumbnail);
        });
    }



    return{
        init: () => {
            state.DOM.songInfo.scrollamount = 0;
            state.DOM.thumbnail.style.background = 'url("https://i.ytimg.com/vi/BYE7DcfovLM/maxresdefault.jpg") center / cover';
            state.playingNow = -1;
            state.isPlaying = false;
            state.totalSongs = 0;
            state.currentSong = {};
            state.currentLoaded = false;
            setupEventListeners();
        }
    }
})(Model, View, Async);

Control.init();