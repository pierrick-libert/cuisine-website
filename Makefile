# Very simple makefile to makelife easier

all: install setup server

clean:
	rm -rf deps assets/node_modules
	rm assets/package-lock.json

install:
	mix deps.get
	mix ecto.setup
	cd assets/ && npm install; cd ../

server:
	mix phx.server
