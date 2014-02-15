#!/usr/bin/env python

import sys
import os
import re
import string
from xmlrpclib import Server
from pprint import pprint


def listify(seq, element):
    """ Turn --files file1.txt file2.txt file3.txt into a list. """
    returnVal = []
    if type(seq) == list:
        returnVal = seq
    elif type(seq) == bool:
        # don't save booleans. This is the result of the argument-parsing
        # function turning strings like --files into True/False values.
        pass
    else:
        returnVal = [seq]

    returnVal.append(element)
    return returnVal


class PushDocs:
    def __init__(self, argv):
        """ Check the arguments and make sure we can log into Confluence """
        usage = "Usage: ./pushdocs.py " \
            "--username=USERNAME --password=PASSWORD " \
            "--server=http://example.com/rpc/xmlrpc " \
            "--files filename [filename2 [...]] " \
            "--debug " \
            "-v" \
            # the debug flag obviates any need for user, password, or server
            # and will make no attempt to endpoint the server even if provided

        self.s = ''
        self.token = ''
        self.thingschanged = True
        self.elements = []
        self.args = {
            'server': 'http://wiki.digium.internal/wiki/rpc/xmlrpc',
            'space': 'Mercury',
            'files': [
                "confluence/client.js",
                "confluence/endpoints.js",
                #"confluence/DocumentationTest",
                "confluence/event.js",
                "confluence/call.js",
                "confluence/signalingChannel.js",
                #"confluence/brightstream",
                "confluence/brightstream.TextMessage",
                "confluence/brightstream.Class",
                "confluence/brightstream.Client",
                "confluence/brightstream.Endpoint",
                "confluence/brightstream.EventEmitter",
                "confluence/brightstream.js",
                "confluence/brightstream.Call",
                "confluence/brightstream.Group",
                "confluence/brightstream.MediaStream",
                "confluence/brightstream.PresenceMessage",
                "confluence/brightstream.Presentable",
                "confluence/brightstream.SignalingChannel",
                "confluence/brightstream.SignalingMessage",
                "confluence/brightstream.User",
                "confluence/brightstream.UserSession"
            ],
            'username': 'espiceland',
            'password': '',
            'force': False,
            'v': False,
            'debug': False
        }
        self.processed = {
            'unchanged': 0,
            'updated': 0,
            'created': 0
        }

        argv.pop(0)
        last = ''
        for a in argv:
            pieces = a.split("=", 1)
            if pieces[0].find('-') != 0:
                self.args[last] = listify(self.args[last], pieces[0])
            else:
                pieces[0] = pieces[0].strip('-')
                last = pieces[0]
                try:
                    self.args[pieces[0]] = pieces[1]
                except:
                    self.args[pieces[0]] = True

        self.parent = 'Client Developer JavaScript API'

        if self.args['username'] == '' or self.args['password'] == '':
            print >> sys.stderr, "Please specify a username and a password."
            sys.exit(1)

        if self.args['space'] == '':
            print >> sys.stderr, "Please specify a Confluence space to use."
            sys.exit(5)

        if self.args['server'] == '' or \
                re.search(r'xmlrpc', self.args['server']) is None:
            print >> sys.stderr, "Please specify a Confluence XMLRPC URL."
            sys.exit(3)

        if not self.args['files']:
            print >> sys.stderr, "Please pass in some files to work on. " \
                + "Remember, names are significant!"
            sys.exit(3)

        self.s = Server(self.args['server'])
        # Detect if we can use v2 of the API or if we have to fall back to v1
        try:
            self.token = self.s.confluence2.login(
                self.args['username'], self.args['password']
            )
            self.api = self.s.confluence2
            self.convert = True
        except:
            self.token = self.s.confluence1.login(
                self.args['username'], self.args['password']
            )
            self.api = self.s.confluence1

        if self.token is None or self.token == '':
            print >> sys.stderr, "Could not log into Confluence!"
            sys.exit(4)

    def update(self):
        """ Format the wiki pages and update Confluence.

        If -v is set, print some extra stuff.
        If --debug is set, do not update any pages on Confluence.

        """

        newpage = {'space': self.args['space']}
        parentpage = self.api.getPage(self.token, self.args['space'],
                                      self.parent)

        if self.args['v'] is True:
            print "Updating Confluence"

        for filename in self.args['files']:
            pagetitle = os.path.basename(filename)

            f = open(filename, 'r')
            wiki = f.read()
            f.close()

            if self.convert is True:
                wiki = self.api.convertWikiToStorageFormat(self.token, wiki)

            try:
                oldpage = self.api.getPage(self.token, self.args['space'],
                                           pagetitle)
                elpage = oldpage.copy()

                elpage['content'] = wiki
                elpage['title'] = pagetitle
                elpage['parentId'] = str(parentpage['id'])
                oldcontent = oldpage['content']
                newcontent = elpage['content']

                # The resulting XML has meaningless inconsistencies.
                # Hack it into submission.
                oldcontent = oldcontent.replace("&quot;", '"')
                oldcontent = oldcontent.replace("<br />", "<br/>")
                oldcontent = oldcontent.replace('<ul class="alternate">',
                                 '<ul class="alternate" type="square">')
                oldcontent = oldcontent.replace(' class="external-link"', "")
                newcontent = newcontent.replace("&#94;", "^")
                newcontent = newcontent.replace("&#8211;", "&ndash;")
                newcontent = newcontent.replace("&#41;", ")")
                newcontent = newcontent.replace("&#95;", "_")
                newcontent = newcontent.replace('class="external-link"', "")

                if oldcontent != newcontent or self.args['force'] is True:
                    if self.args['v']:
                        print elpage['title'], " updated"
                        self.processed['updated'] += 1

                    if self.args['debug'] is not True:
                        self.api.updatePage(self.token, elpage, {
                            'minorEdit': True,
                            'versionComment': 'Automatic API Documentation'
                        })
                else:
                    if self.args['v'] is True:
                        print "%s did not change." % (pagetitle)

            except:
                # The Confluence API throws an exception if we try to
                # update a page that doesn't exist.
                newpage['title'] = pagetitle
                newpage['content'] = wiki
                newpage['parentId'] = str(parentpage['id'])
                try:
                    if self.args['debug'] is not True:
                        page = self.api.storePage(self.token, newpage)

                    if self.args['v']:
                        print newpage['title'], " created"
                        self.processed['created'] += 1
                except Error as e:
                    print "Couldn't store the page:", e.strerror
                    pass


def main(argv):
    '''
    Usage: ./pushdocs.py --username=USERNAME --password=PASSWORD
[--server=http://example.com/rpc/xmlrpc]
--files [filename [filename2 [...]]
[-v]
[--debug]
    '''

    a = PushDocs(argv)
    a.update()
    if a.args['v'] is True:
        for k in a.processed:
            print k, " ", a.processed[k]

    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv) or 0)
