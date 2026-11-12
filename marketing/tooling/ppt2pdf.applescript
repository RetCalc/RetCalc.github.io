-- Exports a deck to PDF through PowerPoint: ppt2pdf <in.pptx> <out.pdf>
-- Finds its presentation by file name, so another open deck is never saved
-- or closed by mistake. Large decks can take ten minutes or more.
on run argv
	set inFile to item 1 of argv
	set outFile to item 2 of argv
	set AppleScript's text item delimiters to "/"
	set nm to last text item of inFile
	set AppleScript's text item delimiters to ""
	with timeout of 1800 seconds
		tell application "Microsoft PowerPoint"
			open (POSIX file inFile)
			repeat 900 times
				if (name of every presentation) contains nm then exit repeat
				delay 1
			end repeat
			delay 2
			save presentation nm in (POSIX file outFile) as save as PDF
			close presentation nm saving no
		end tell
	end timeout
end run
